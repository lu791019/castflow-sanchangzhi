-- 024 共鳴「這句我也是」：讀者在文章某一段旁留下記號（P3）。
-- 單位是 AI 整理時切好的「段」（分享頁正文的 paragraph block），每人每段一個記號、可收回（刪列）。
--
-- 段的識別：(episode_id, passage_hash)。
--   * passage_hash = 段落文字正規化（去頭尾空白、連續空白收成一格）後 SHA-256 的前 16 碼 hex。
--   * 作者日後改字：改到的那段雜湊對不上，舊記號不顯示、不計數（列留著，改回原字會再出現）；
--     沒改到的段即使前後插段、順序變了，記號仍跟著原文走。
--   * passage_index 只是寫入當下的段序（排序與除錯用），不參與比對。
--   * passage_text 是寫入當下的段落文字快照，作品特輯「大家最有共鳴的一句」用；顯示前仍會跟現行正文比對雜湊。
--
-- user_id 沿用全站慣例存 auth uid 字串（text）。寫入只走 server（service role），
-- RLS 開啟：登入者只能讀／刪自己的記號；anon 讀不到。
create table if not exists passage_resonances (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  user_id text not null,
  passage_hash text not null,
  passage_index integer not null,
  passage_text text not null,
  created_at timestamptz not null default now(),
  constraint passage_resonances_hash_shape check (passage_hash ~ '^[0-9a-f]{16}$'),
  constraint passage_resonances_index_range check (passage_index between 0 and 999),
  constraint passage_resonances_text_length check (char_length(passage_text) between 1 and 4000),
  constraint passage_resonances_one_per_user unique (episode_id, passage_hash, user_id)
);

-- 文章頁：依 episode 撈全部段的記號
create index if not exists idx_passage_resonances_episode
  on passage_resonances(episode_id, passage_hash);
-- 使用者刪帳號／查自己的記號
create index if not exists idx_passage_resonances_user
  on passage_resonances(user_id, created_at desc);

alter table passage_resonances enable row level security;

drop policy if exists passage_resonances_owner_select on passage_resonances;
create policy passage_resonances_owner_select on passage_resonances
  for select to authenticated
  using (user_id = (select auth.uid())::text);

drop policy if exists passage_resonances_owner_delete on passage_resonances;
create policy passage_resonances_owner_delete on passage_resonances
  for delete to authenticated
  using (user_id = (select auth.uid())::text);
