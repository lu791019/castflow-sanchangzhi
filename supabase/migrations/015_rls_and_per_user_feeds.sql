-- 015 上線前安全收尾：全表開 RLS + feeds 每人一份（同一 feed 多人訂閱共享逐字稿，不重複轉錄）
--
-- 授權模型（不變）：
--   * App server（server component / server action / API route）與 worker 一律用 service role，
--     service role 繞過 RLS；擁有者檢查在程式層（.eq("user_id", uid)、src/lib/auth/ownership.ts）。
--   * 瀏覽器已不直連任何資料表（015 同時把 episodes/[id]/edit、generate、styles/[id]、上傳表單改走 server）。
--   * RLS 是第二道防線：anon key 是公開的，沒有 RLS 時任何人都能直接打 PostgREST 讀寫全部資料。
--
-- 公開頁面（分享頁 /s/[slug]、作品特輯 /works、首頁目錄、/proof）全部走 service role 讀取，
-- 所以「已發佈／公開文章」不開任何匿名 policy（最小權限）。唯一給匿名讀的是 works（公開作品目錄，無個人資料）。
--
-- 冪等：policy 先 drop if exists 再建；可重複執行。

-- ── 1. feeds：url 全域唯一 → (user_id, url) 唯一 ─────────────────────
alter table feeds drop constraint if exists feeds_url_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feeds_user_id_url_key') then
    alter table feeds add constraint feeds_user_id_url_key unique (user_id, url);
  end if;
end $$;
-- 找「同 url 的其他人的 feed」用
create index if not exists idx_feeds_url on feeds(url);

-- ── 2. 同一 feed 多人訂閱：共享逐字稿與閱讀產出 ─────────────────────
-- 「兄弟集數」：不同 feeds 列但 url 相同、guid 相同的 episodes（各自屬於不同使用者）。
-- 取捨：每人保有自己的 episode 列（擁有權模型、RLS、journal/文案都不用改），
-- 只把昂貴的轉錄與閱讀產出複製過去；worker 不用改：
--   * 兩人的集數同時在佇列：worker 依序處理，第一集寫入 transcript 時觸發器把兄弟集數
--     改成 transcribed 並複製逐字稿，worker 輪到兄弟集數時 claim（只認 uploaded）失敗 → 跳過。
--   * 晚訂閱的人：建集數當下若兄弟已有逐字稿，直接複製並標 transcribed，不進轉錄佇列。
--   * 閱讀（雙語/摘要/章節）ready 時複製給已有逐字稿、尚無閱讀的兄弟集數。
--   * 6 平台文案（contents）不複製：屬個人風格產物，兄弟集數需要時自行在 generate 頁生成。
-- 安全：逐字稿／閱讀只允許 service role 寫（下方 policy 不給 authenticated 寫入），
-- 使用者無法偽造內容經由觸發器擴散到別人的集數。函式用 invoker 權限，不是 security definer。

-- 共享邏輯全部內嵌在 trigger 函式裡，不另建可從 PostgREST /rpc 呼叫的 helper 函式
-- （trigger 函式 PostgREST 不暴露、直接呼叫也只會報錯），所以 015 不新增任何需要 revoke 的函式。

-- 逐字稿寫入 → 複製給仍在佇列（uploaded）的兄弟集數
create or replace function share_transcript_to_feed_siblings()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sibling uuid;
begin
  -- 觸發器自己複製出來的逐字稿不再擴散
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  for v_sibling in
    select s.id
    from episodes e
    join feeds f on f.id = e.feed_id
    join feeds sf on sf.url = f.url and sf.id <> f.id
    join episodes s on s.feed_id = sf.id and s.guid = e.guid
    where e.id = new.episode_id and e.guid is not null and s.id <> e.id
  loop
    update episodes set status = 'transcribed'
    where id = v_sibling and status = 'uploaded';
    if found then
      insert into transcripts (episode_id, full_text, segments, language)
      values (v_sibling, new.full_text, new.segments, new.language);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_transcripts_share_feed_siblings on transcripts;
create trigger trg_transcripts_share_feed_siblings
  after insert on transcripts
  for each row execute function share_transcript_to_feed_siblings();

-- 新的 RSS 集數 → 若兄弟集數已有逐字稿，直接沿用（含已完成的閱讀），不進轉錄佇列
create or replace function adopt_feed_sibling_transcript()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_source record;
  v_tx uuid;
begin
  if pg_trigger_depth() > 1 or new.status <> 'uploaded' then
    return new;
  end if;

  select t.episode_id, t.full_text, t.segments, t.language into v_source
  from feeds f
  join feeds sf on sf.url = f.url and sf.id <> f.id
  join episodes s on s.feed_id = sf.id and s.guid = new.guid
  join transcripts t on t.episode_id = s.id
  where f.id = new.feed_id
  order by t.created_at desc
  limit 1;
  if v_source is null then
    return new;
  end if;

  insert into transcripts (episode_id, full_text, segments, language)
  values (new.id, v_source.full_text, v_source.segments, v_source.language)
  returning id into v_tx;
  update episodes set status = 'transcribed' where id = new.id;

  insert into episode_readings (
    episode_id, transcript_id, status, source_language, target_language,
    segments, summary, chapters, error_message
  )
  select new.id, v_tx, r.status, r.source_language, r.target_language,
         r.segments, r.summary, r.chapters, r.error_message
  from episode_readings r
  where r.episode_id = v_source.episode_id and r.status in ('ready', 'skipped')
  on conflict (episode_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_episodes_adopt_feed_sibling on episodes;
create trigger trg_episodes_adopt_feed_sibling
  after insert on episodes
  for each row
  when (new.feed_id is not null and new.guid is not null)
  execute function adopt_feed_sibling_transcript();

-- 閱讀 ready/skipped → 複製給已有逐字稿、尚無閱讀的兄弟集數（transcript_id 指向兄弟自己最新的逐字稿，
-- 否則閱讀頁會判成 stale）
create or replace function share_reading_to_feed_siblings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 or new.status not in ('ready', 'skipped') then
    return new;
  end if;

  insert into episode_readings (
    episode_id, transcript_id, status, source_language, target_language,
    segments, summary, chapters, error_message
  )
  select s.id,
         (select t.id from transcripts t where t.episode_id = s.id order by t.created_at desc limit 1),
         new.status, new.source_language, new.target_language,
         new.segments, new.summary, new.chapters, new.error_message
  from episodes e
  join feeds f on f.id = e.feed_id
  join feeds sf on sf.url = f.url and sf.id <> f.id
  join episodes s on s.feed_id = sf.id and s.guid = e.guid
  where e.id = new.episode_id
    and e.guid is not null
    and s.id <> e.id
    and exists (select 1 from transcripts t where t.episode_id = s.id)
  on conflict (episode_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_episode_readings_share_feed_siblings on episode_readings;
create trigger trg_episode_readings_share_feed_siblings
  after insert or update of status on episode_readings
  for each row execute function share_reading_to_feed_siblings();

-- ── 2b. claim_legacy_data：維持 013 的授權（只給 service_role） ──
-- 不改函式本體，只重申授權（冪等）。
--
-- ⚠ 已知 image bug（supabase/postgres 17.6.1.106，本地 Supabase CLI 使用的版本；015 開發時實測）：
--   以 postgres 管理帳號連線 → SET ROLE anon/authenticated → 呼叫沒有 EXECUTE 權限的函式，
--   整個 Postgres 會 segfault（signal 11）後進 recovery，所有連線中斷。
--   * 不受影響（實測正常回 42501）：PostgREST /rpc（anon、authenticated JWT 皆是）、
--     以 authenticator 等非管理帳號登入後 SET ROLE 再呼叫。所以對外不是 DoS，revoke 照用。
--   * 繞法：驗證權限時不要在 postgres session 用 SET ROLE 實際呼叫被 revoke 的函式，
--     改用 has_function_privilege()，或走 PostgREST／authenticator 登入。
--   * 雲端專案 image 版本可能不同：上線前要對雲端以 PostgREST 路徑再驗一次
--     （anon 打 /rest/v1/rpc/claim_legacy_data 應回 401/42501，且 DB 不中斷）。
revoke all on function claim_legacy_data(text) from public, anon, authenticated;
grant execute on function claim_legacy_data(text) to service_role;

-- ── 3. 全部 public 表開 RLS ────────────────────────────────────────
alter table episodes enable row level security;
alter table transcripts enable row level security;
alter table writing_rules enable row level security;
alter table style_dnas enable row level security;
alter table style_examples enable row level security;
alter table platform_templates enable row level security;
alter table contents enable row level security;
alter table publish_logs enable row level security;
alter table settings enable row level security;
alter table feeds enable row level security;
alter table works enable row level security;
alter table episode_readings enable row level security;
alter table journal_entries enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table profiles enable row level security;

-- ── 4. 有 user_id 的使用者資料表：只能讀寫自己的列（authenticated） ──
-- auth.uid() 包在 select 內，讓 Postgres 每個查詢只算一次（Supabase 建議寫法）。
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'episodes', 'contents', 'writing_rules', 'style_dnas', 'style_examples',
    'platform_templates', 'journal_entries', 'notifications', 'push_subscriptions', 'feeds'
  ] loop
    execute format('drop policy if exists %I on %I', v_table || '_owner_all', v_table);
    execute format(
      'create policy %I on %I for all to authenticated '
      'using (user_id = (select auth.uid())::text) '
      'with check (user_id = (select auth.uid())::text)',
      v_table || '_owner_all', v_table
    );
  end loop;
end $$;

-- ── 5. 經 episode 連到擁有者的衍生資料：登入者只能讀，寫入只給 service role ──
drop policy if exists transcripts_owner_select on transcripts;
create policy transcripts_owner_select on transcripts
  for select to authenticated
  using (exists (
    select 1 from episodes e
    where e.id = transcripts.episode_id and e.user_id = (select auth.uid())::text
  ));

drop policy if exists episode_readings_owner_select on episode_readings;
create policy episode_readings_owner_select on episode_readings
  for select to authenticated
  using (exists (
    select 1 from episodes e
    where e.id = episode_readings.episode_id and e.user_id = (select auth.uid())::text
  ));

drop policy if exists publish_logs_owner_select on publish_logs;
create policy publish_logs_owner_select on publish_logs
  for select to authenticated
  using (exists (
    select 1 from contents c
    where c.id = publish_logs.content_id and c.user_id = (select auth.uid())::text
  ));

-- ── 6. profiles：只能讀／建／改自己的（刪除隨 auth.users cascade） ──
drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles
  for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── 7. works：公開目錄，任何人可讀；寫入只給 service role ──
drop policy if exists works_public_select on works;
create policy works_public_select on works
  for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on works from anon, authenticated;

-- ── 8. settings：只給 service role（含 Meta token、legacy_claim 等全站設定） ──
-- 不建任何 policy，並收回 anon/authenticated 的表權限（讀取直接 permission denied）。
revoke all on settings from anon, authenticated;
