-- 013 多人化地基：profiles（筆名）、舊資料認領、user_id 索引
--
-- 身分模型：
--   * 帳號 = Supabase Auth（email magic link），auth.users.id 是 uuid。
--   * 既有各表 user_id 維持 text（存 auth uid 的字串形式），不改型別，避免動到既有資料與 FK。
--   * user_id 的 default 'default' 保留，讓舊資料與尚未改寫的寫入路徑不會壞；
--     新寫入一律由 server 帶真實 uid（程式層保證），'default' 只代表「尚未認領的單人時期資料」。
--
-- 為什麼這次不開 RLS：
--   * server 端全部走 service role（createAdminClient）＋程式層 .eq("user_id", uid) 過濾，
--     service role 本來就繞過 RLS，開了也擋不到這條路徑。
--   * 但 anon key 是公開的，RLS 關閉代表任何人都能直接打 PostgREST 讀寫所有表——
--     這是已知風險，只在本地／封閉測試可接受。
--   * 何時開：對外開放註冊（或把 anon key 放上公開網域）之前必須開。
--     屆時 policy 用 auth.uid()::text = user_id（或改 uuid 欄位），
--     並把瀏覽器端直連查詢（episodes/[id]/edit、generate、styles/[id]）改走 server。

-- ── profiles ────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pen_name text unique,
  created_at timestamptz not null default now(),
  constraint profiles_pen_name_shape check (
    pen_name is null
    or (
      pen_name = btrim(pen_name)
      and char_length(pen_name) between 1 and 20
    )
  )
);

-- ── feeds 也要有擁有者（poll 建立的集數沿用 feed 的 user_id） ──
alter table feeds add column if not exists user_id text not null default 'default';

-- ── user_id 索引（journal_entries / notifications 已有以 user_id 開頭的複合索引，不重建） ──
create index if not exists idx_episodes_user_id on episodes(user_id, created_at desc);
create index if not exists idx_contents_user_id on contents(user_id);
create index if not exists idx_writing_rules_user_id on writing_rules(user_id);
create index if not exists idx_style_dnas_user_id on style_dnas(user_id);
create index if not exists idx_style_examples_user_id on style_examples(user_id);
create index if not exists idx_platform_templates_user_id on platform_templates(user_id);
create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);
create index if not exists idx_feeds_user_id on feeds(user_id);

-- ── 子表沿用父列的 user_id（worker 寫入不帶 user_id 時的保險） ──
-- contents 由 worker 呼叫的 /api/generate 寫入、notifications 由 worker 直接寫入，
-- 兩者都不帶 user_id；只在值仍是 'default' 時補上父列的擁有者，程式有帶就不覆蓋。
create or replace function inherit_user_id_from_episode()
returns trigger
language plpgsql
as $$
begin
  if new.user_id = 'default' and new.episode_id is not null then
    select e.user_id into new.user_id from episodes e where e.id = new.episode_id;
    new.user_id := coalesce(new.user_id, 'default');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contents_inherit_user_id on contents;
create trigger trg_contents_inherit_user_id
  before insert on contents
  for each row execute function inherit_user_id_from_episode();

create or replace function inherit_user_id_from_journal()
returns trigger
language plpgsql
as $$
begin
  if new.user_id = 'default' and new.journal_entry_id is not null then
    select j.user_id into new.user_id from journal_entries j where j.id = new.journal_entry_id;
    new.user_id := coalesce(new.user_id, 'default');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_inherit_user_id on notifications;
create trigger trg_notifications_inherit_user_id
  before insert on notifications
  for each row execute function inherit_user_id_from_journal();

-- ── 認領單人時期的舊資料 ───────────────────────────────────
-- 第一個呼叫的使用者把所有 user_id='default' 的列改成自己的 uid；
-- 完成後在 settings 記 legacy_claim，之後任何人都不能再認領。
-- 單一 transaction + advisory lock：兩個人同時按也只會有一人成功。
create or replace function claim_legacy_data(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_table text;
  v_n integer;
begin
  if p_uid is null or p_uid = '' or p_uid = 'default' then
    raise exception 'invalid uid';
  end if;

  perform pg_advisory_xact_lock(hashtext('claim_legacy_data'));

  if exists (select 1 from settings where key = 'legacy_claim') then
    return jsonb_build_object('claimed', false, 'reason', 'already_claimed');
  end if;

  foreach v_table in array array[
    'episodes', 'contents', 'writing_rules', 'style_dnas', 'style_examples',
    'platform_templates', 'journal_entries', 'notifications', 'push_subscriptions', 'feeds'
  ] loop
    execute format('update %I set user_id = $1 where user_id = %L', v_table, 'default')
      using p_uid;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object(v_table, v_n);
  end loop;

  insert into settings (key, value, updated_at)
  values (
    'legacy_claim',
    jsonb_build_object('user_id', p_uid, 'claimed_at', now(), 'counts', v_counts),
    now()
  );

  return jsonb_build_object('claimed', true, 'counts', v_counts);
end;
$$;

-- RLS 未開時 PostgREST 會把 public schema 的函式暴露成 /rpc：只允許 service role 呼叫，
-- 否則任何持有 anon key 的人都能搶先認領。
revoke all on function claim_legacy_data(text) from public;
revoke all on function claim_legacy_data(text) from anon, authenticated;
grant execute on function claim_legacy_data(text) to service_role;
