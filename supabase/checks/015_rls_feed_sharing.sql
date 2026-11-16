-- 015 驗證腳本：RLS policy 與「同一 feed 多人訂閱共享逐字稿」觸發器。
-- 全部在一個 transaction 內執行、最後 rollback，不留資料；任一斷言失敗即 raise exception。
-- 執行（主機無 psql，走 container）：
--   docker exec -i supabase_db_social-media-product psql -U postgres -v ON_ERROR_STOP=1 \
--     < supabase/checks/015_rls_feed_sharing.sql

begin;

-- 測試用 uid（不需要真的存在於 auth.users：各表 user_id 是 text，無 FK）
\set ua '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set ub '''bbbbbbbb-0000-4000-8000-00000000000b'''
\set uc '''cccccccc-0000-4000-8000-00000000000c'''

-- ── 1. feeds 每人一份 ────────────────────────────────────────
insert into feeds (id, user_id, url, title) values
  ('f1000000-0000-4000-8000-000000000001', :ua, 'https://check.example/rss', 'Check'),
  ('f2000000-0000-4000-8000-000000000002', :ub, 'https://check.example/rss', 'Check');

do $$
begin
  begin
    insert into feeds (user_id, url) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'https://check.example/rss');
    raise exception 'FAIL: 同一人重複訂閱同一 url 應被擋';
  exception when unique_violation then
    null;
  end;
end $$;

-- ── 2. 兩人都在佇列（uploaded）：A 先轉錄完 → B 自動拿到逐字稿、狀態 transcribed ──
insert into episodes (id, user_id, title, status, audio_url, feed_id, guid, source) values
  ('e1000000-0000-4000-8000-000000000001', :ua, 'EP1', 'transcribing', 'https://check.example/1.mp3',
   'f1000000-0000-4000-8000-000000000001', 'guid-1', 'rss'),
  ('e2000000-0000-4000-8000-000000000002', :ub, 'EP1', 'uploaded', 'https://check.example/1.mp3',
   'f2000000-0000-4000-8000-000000000002', 'guid-1', 'rss'),
  ('e2200000-0000-4000-8000-000000000022', :ub, 'EP2', 'uploaded', 'https://check.example/2.mp3',
   'f2000000-0000-4000-8000-000000000002', 'guid-2', 'rss');

insert into transcripts (episode_id, full_text, segments, language)
values ('e1000000-0000-4000-8000-000000000001', '共享的逐字稿', '[{"start":0,"end":1,"text":"hi"}]', 'en');

do $$
declare
  v_status text;
  v_text text;
  v_count int;
begin
  select status into v_status from episodes where id = 'e2000000-0000-4000-8000-000000000002';
  if v_status <> 'transcribed' then
    raise exception 'FAIL: 同 guid 的兄弟集數應被標 transcribed，實際 %', v_status;
  end if;
  select full_text into v_text from transcripts where episode_id = 'e2000000-0000-4000-8000-000000000002';
  if v_text is distinct from '共享的逐字稿' then
    raise exception 'FAIL: 兄弟集數應拿到同一份逐字稿，實際 %', v_text;
  end if;
  select status into v_status from episodes where id = 'e1000000-0000-4000-8000-000000000001';
  if v_status <> 'transcribing' then
    raise exception 'FAIL: 來源集數狀態不該被觸發器改動（由 worker 負責），實際 %', v_status;
  end if;
  select status into v_status from episodes where id = 'e2200000-0000-4000-8000-000000000022';
  if v_status <> 'uploaded' then
    raise exception 'FAIL: 不同 guid 不該被共享，實際 %', v_status;
  end if;
  select count(*) into v_count from transcripts where episode_id = 'e1000000-0000-4000-8000-000000000001';
  if v_count <> 1 then
    raise exception 'FAIL: 來源集數逐字稿應只有 1 份，實際 %', v_count;
  end if;
end $$;

-- ── 3. A 的閱讀產出 ready → 複製給已有逐字稿、尚無閱讀的兄弟集數 ──
insert into episode_readings (episode_id, transcript_id, status, source_language, segments, summary, chapters)
select 'e1000000-0000-4000-8000-000000000001', id, 'pending', 'en', '[]', '[]', '[]'
from transcripts where episode_id = 'e1000000-0000-4000-8000-000000000001';

do $$
begin
  if exists (select 1 from episode_readings where episode_id = 'e2000000-0000-4000-8000-000000000002') then
    raise exception 'FAIL: pending 的閱讀不該被複製';
  end if;
end $$;

update episode_readings
set status = 'ready', segments = '[{"source_text":"hi","translated_text":"嗨"}]', summary = '["重點"]'
where episode_id = 'e1000000-0000-4000-8000-000000000001';

do $$
declare
  v_reading record;
  v_tx uuid;
begin
  select * into v_reading from episode_readings where episode_id = 'e2000000-0000-4000-8000-000000000002';
  if v_reading is null or v_reading.status <> 'ready' then
    raise exception 'FAIL: 兄弟集數應拿到 ready 的閱讀';
  end if;
  select id into v_tx from transcripts where episode_id = 'e2000000-0000-4000-8000-000000000002';
  if v_reading.transcript_id is distinct from v_tx then
    raise exception 'FAIL: 複製的閱讀要指向兄弟集數自己的逐字稿（否則會被判 stale）';
  end if;
end $$;

-- ── 4. 之後才訂閱的人：建集數當下就沿用既有逐字稿與閱讀，不進轉錄佇列 ──
insert into feeds (id, user_id, url) values
  ('f3000000-0000-4000-8000-000000000003', :uc, 'https://check.example/rss');
insert into episodes (id, user_id, title, status, audio_url, feed_id, guid, source) values
  ('e3000000-0000-4000-8000-000000000003', :uc, 'EP1', 'uploaded', 'https://check.example/1.mp3',
   'f3000000-0000-4000-8000-000000000003', 'guid-1', 'rss');

do $$
declare
  v_status text;
  v_reading_status text;
  v_reading_tx uuid;
  v_tx uuid;
begin
  select status into v_status from episodes where id = 'e3000000-0000-4000-8000-000000000003';
  if v_status <> 'transcribed' then
    raise exception 'FAIL: 晚訂閱者的新集數應直接 transcribed，實際 %', v_status;
  end if;
  select id into v_tx from transcripts where episode_id = 'e3000000-0000-4000-8000-000000000003';
  if v_tx is null then
    raise exception 'FAIL: 晚訂閱者應拿到逐字稿';
  end if;
  select status, transcript_id into v_reading_status, v_reading_tx
  from episode_readings where episode_id = 'e3000000-0000-4000-8000-000000000003';
  if v_reading_status is distinct from 'ready' or v_reading_tx is distinct from v_tx then
    raise exception 'FAIL: 晚訂閱者應拿到指向自己逐字稿的 ready 閱讀';
  end if;
end $$;

-- ── 5. RLS：anon 什麼都讀不到（works 除外）──────────────────
insert into works (kind, title, slug) values ('movie', 'RLS 檢查作品', 'rls-check-work-015');

set local role anon;
do $$
declare
  v_table text;
  v_count int;
begin
  foreach v_table in array array[
    'episodes', 'contents', 'transcripts', 'episode_readings', 'journal_entries', 'notifications',
    'push_subscriptions', 'feeds', 'style_dnas', 'style_examples', 'writing_rules',
    'platform_templates', 'publish_logs', 'profiles'
  ] loop
    execute format('select count(*) from %I', v_table) into v_count;
    if v_count <> 0 then
      raise exception 'FAIL: anon 讀 % 應為 0 列，實際 %', v_table, v_count;
    end if;
  end loop;

  begin
    perform 1 from settings;
    raise exception 'FAIL: anon 不該能讀 settings';
  exception when insufficient_privilege then
    null;
  end;

  if not exists (select 1 from works where slug = 'rls-check-work-015') then
    raise exception 'FAIL: anon 應能讀 works';
  end if;

  begin
    insert into works (kind, title, slug) values ('movie', 'x', 'anon-should-fail');
    raise exception 'FAIL: anon 不該能寫 works';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into episodes (user_id, title) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x');
    raise exception 'FAIL: anon 不該能寫 episodes';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;


-- ── 6. RLS：登入者只看得到自己的列 ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare
  v_count int;
begin
  select count(*) into v_count from episodes;
  if v_count <> 2 then
    raise exception 'FAIL: B 應只看到自己 2 集，實際 %', v_count;
  end if;
  select count(*) into v_count from transcripts;
  if v_count <> 1 then
    raise exception 'FAIL: B 應只看到自己集數的 1 份逐字稿，實際 %', v_count;
  end if;
  select count(*) into v_count from episode_readings;
  if v_count <> 1 then
    raise exception 'FAIL: B 應只看到自己 1 份閱讀，實際 %', v_count;
  end if;
  select count(*) into v_count from feeds;
  if v_count <> 1 then
    raise exception 'FAIL: B 應只看到自己 1 個 feed，實際 %', v_count;
  end if;

  -- 改不到別人的列（RLS 過濾後 0 列受影響）
  update episodes set title = 'hacked' where id = 'e1000000-0000-4000-8000-000000000001';
  if exists (select 1 from episodes where title = 'hacked') then
    raise exception 'FAIL: B 不該看到被改的列';
  end if;

  -- 不能以別人身分新增
  begin
    insert into episodes (user_id, title) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x');
    raise exception 'FAIL: B 不該能以 A 的 user_id 新增';
  exception when insufficient_privilege then
    null;
  end;

  -- 逐字稿／閱讀只能讀，不能寫（會被觸發器共享給其他人，只允許 service role 寫）
  begin
    insert into transcripts (episode_id, full_text)
    values ('e2200000-0000-4000-8000-000000000022', '偽造');
    raise exception 'FAIL: 登入者不該能直接寫逐字稿';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform 1 from settings;
    raise exception 'FAIL: 登入者不該能讀 settings';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

do $$
begin
  if exists (select 1 from episodes where title = 'hacked') then
    raise exception 'FAIL: B 竟然改到 A 的集數';
  end if;
end $$;

-- ── 7. 函式授權盤點：只有 claim_legacy_data 收回 anon/authenticated 的 EXECUTE ──
-- ⚠ 不要在這支腳本（postgres session）裡 SET ROLE anon/authenticated 後「實際呼叫」被 revoke 的函式：
--   supabase/postgres 17.6.1.106 在這條路徑會 segfault 整個 DB（PostgREST／非管理帳號登入不受影響）。
--   一律用 has_function_privilege() 檢查授權；實際呼叫的驗證走 PostgREST。
do $$
declare
  v_names text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_names
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (not has_function_privilege('anon', p.oid, 'execute')
         or not has_function_privilege('authenticated', p.oid, 'execute'));
  if v_names is distinct from 'claim_legacy_data' then
    raise exception 'FAIL: 收回 EXECUTE 的函式應只有 claim_legacy_data，實際 %', v_names;
  end if;
  if not has_function_privilege('service_role', 'claim_legacy_data(text)', 'execute') then
    raise exception 'FAIL: service_role 應能呼叫 claim_legacy_data';
  end if;
end $$;

select 'ALL 015 CHECKS PASSED' as result;
rollback;
