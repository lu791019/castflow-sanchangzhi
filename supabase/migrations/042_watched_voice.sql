-- 第 0 步「看完了 → 你語氣的 Threads」（Q-69～Q-85，10/26）
-- 1. journal_entries.rating：0.5～5 星、每 0.5 一階，可不打（Q-72）。只有本人看得到（Q-83）：
--    日誌本來就只走 server（service role＋userId 過濾），作品頁只出匿名彙總，不另開 policy。
-- 2. voice_samples：每人一份語氣樣本（Q-75、Q-79～Q-81）。
--    source：paste＝自己貼的貼文、spoken＝在散場誌說一段的原話（逐字稿）、threads_api＝之後用 Threads API 讀自己的貼文。
--    AI 產出的貼文一律不寫進來（語料不收 AI 稿）。
--    只給 server：RLS 開、不建 policy，並撤掉 anon／authenticated 的所有權限 → 使用者端直連讀不到任何人的樣本，
--    本人讀寫由 server 依 userId 過濾（同 spotify_connections）。不進配對、不拿去學別人的語氣（Q-81）。
-- 冪等可重複執行

alter table journal_entries add column if not exists rating numeric(2,1);
alter table journal_entries drop constraint if exists journal_entries_rating_check;
alter table journal_entries add constraint journal_entries_rating_check
  check (rating is null or (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)));

create table if not exists voice_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  source text not null check (source in ('paste', 'spoken', 'threads_api')),
  -- spoken 才有：哪一段說一段（刪掉那段錄音時樣本跟著刪）
  episode_id uuid references episodes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint voice_samples_spoken_episode check (source <> 'spoken' or episode_id is not null)
);

create index if not exists idx_voice_samples_user_created
  on voice_samples(user_id, created_at desc);

-- 同一段說一段只收一次（重跑冪等）
create unique index if not exists uq_voice_samples_episode
  on voice_samples(episode_id);

alter table voice_samples enable row level security;
revoke all on voice_samples from anon, authenticated;
