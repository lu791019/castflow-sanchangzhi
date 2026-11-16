-- 封面補齊 第二輪（Dex 10/13 深夜拍板 Q-45～Q-47）
-- work_cover_submissions：讀者補的場刊封面（貼網址經 server 轉存，或上傳），一律先進這張表。
--   url 只存自家 `covers` 桶的公開網址（外部網址由 server 下載轉存，不熱連結）。
--   source 'url'：來源網域在白名單 → approved 並補空的 works.poster_url；白名單外 → pending。
--   source 'upload'：內容無法自動判斷 → 一律 pending，等人工審（npm run covers:review）。
--   user_id 沿用全站慣例存 auth uid 字串（text）。
--   RLS 比照 work_links：任何人只讀得到 approved 列、看不到 user_id；寫入只走 server（service role）。
-- 冪等可重複執行。

create table if not exists work_cover_submissions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works(id) on delete cascade,
  user_id text not null,
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  source text not null check (source in ('upload', 'url')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_work_cover_submissions_pending
  on work_cover_submissions (created_at) where status = 'pending';
create index if not exists idx_work_cover_submissions_work
  on work_cover_submissions (work_id, created_at desc);

alter table work_cover_submissions enable row level security;

drop policy if exists work_cover_submissions_public_select on work_cover_submissions;
create policy work_cover_submissions_public_select on work_cover_submissions
  for select to anon, authenticated using (status = 'approved');
revoke insert, update, delete, truncate on work_cover_submissions from anon, authenticated;

-- user_id 不給匿名／登入者直接讀（只經 server 組裝後輸出）
revoke select on work_cover_submissions from anon, authenticated;
grant select (id, work_id, url, source, status, created_at, reviewed_at)
  on work_cover_submissions to anon, authenticated;
