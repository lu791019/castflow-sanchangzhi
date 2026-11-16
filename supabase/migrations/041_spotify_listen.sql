-- Spotify 收聽紀錄提醒（Q-64 C1，10/16）：允許名單內的人連結 Spotify，worker 定期拉最近播放，聽完一張專輯就問「要不要記一筆？」
-- 1. spotify_connections：每位使用者一列，存加密後的 refresh token（AES-256-GCM，金鑰在 env SPOTIFY_TOKEN_KEY，DB 只有密文）。
--    只給 server（service role）：RLS 開、不建任何 policy，並撤掉 anon／authenticated 的所有權限 → 使用者端連自己的列都讀不到。
--    刪帳號隨 auth.users cascade 一起刪。不存收聽紀錄本身（worker 每次只拿最近 50 首在記憶體判斷）。
-- 2. notifications：kind 加 'listen_prompt'；加 url（點了去哪，記一筆並預選專輯）與 dedupe_key（同一張專輯同一天只問一次）。
--    unique(user_id, dedupe_key)：worker 重跑冪等；dedupe_key 為 null 的舊通知彼此不衝突（null 不相等）。
--    不用 partial index：PostgREST upsert 的 on_conflict 推不到帶 where 的索引。
-- 冪等可重複執行

create table if not exists spotify_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- v1:<iv>:<tag>:<密文>（base64url），AAD＝user_id，換列就解不開
  refresh_token_enc text not null check (refresh_token_enc like 'v1:%' and char_length(refresh_token_enc) <= 4000),
  scope text not null default '',
  status text not null default 'active' check (status in ('active', 'revoked')),
  -- 最近一次拉取失敗的原因（給維運看，不給使用者端）
  last_error text check (last_error is null or char_length(last_error) <= 500),
  last_polled_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- worker 撈該拉的人：active 且最久沒拉的先
create index if not exists idx_spotify_connections_due
  on spotify_connections(last_polled_at nulls first)
  where status = 'active';

alter table spotify_connections enable row level security;
revoke all on spotify_connections from anon, authenticated;

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('say_reminder', 'plan_reminder', 'settle_prompt', 'listen_prompt'));

alter table notifications add column if not exists url text;
alter table notifications drop constraint if exists notifications_url_check;
alter table notifications add constraint notifications_url_check
  check (url is null or (url like '/%' and url not like '//%' and char_length(url) <= 500));

alter table notifications add column if not exists dedupe_key text;
alter table notifications drop constraint if exists notifications_dedupe_key_check;
alter table notifications add constraint notifications_dedupe_key_check
  check (dedupe_key is null or char_length(dedupe_key) <= 200);

create unique index if not exists uq_notifications_user_dedupe
  on notifications(user_id, dedupe_key);
