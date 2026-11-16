-- 在哪看／去哪買票（散場之前 A，10/13 grill Q-27～Q-36）
-- 1. work_links：作品的外部連結（在哪看／買票／官網）。來源 origin 決定顯示優先序（user > curated > manual/tmdb > 搜尋連結）。
--    同一作品同一來源（netflix、kktix、official…）只留一筆：unique(work_id, source)。
--    status 'pending'：使用者補的網址不在白名單網域，待審不公開。
--    RLS 同 works：任何人可讀「公開」列；寫入只走 server（service role）。
-- 2. works.venue_type：場館類型兩層（演出／展覽），決定售票搜尋連結的前兩顆。可空。
-- 冪等可重複執行。

create table if not exists work_links (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works(id) on delete cascade,
  kind text not null check (kind in ('watch', 'ticket', 'official')),
  source text not null check (char_length(source) between 1 and 64),
  label text not null check (char_length(label) between 1 and 40),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  origin text not null check (origin in ('tmdb', 'curated', 'manual', 'user')),
  status text not null default 'active' check (status in ('active', 'pending')),
  added_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, source)
);

create index if not exists idx_work_links_work on work_links(work_id) where status = 'active';

alter table work_links enable row level security;

drop policy if exists work_links_public_select on work_links;
create policy work_links_public_select on work_links
  for select to anon, authenticated using (status = 'active');
revoke insert, update, delete, truncate on work_links from anon, authenticated;

-- added_by 是使用者 id，不給匿名／登入者直接讀（只經 server 組裝後輸出）
revoke select on work_links from anon, authenticated;
grant select (id, work_id, kind, source, label, url, origin, status, created_at, updated_at)
  on work_links to anon, authenticated;

alter table works add column if not exists venue_type text;

alter table works drop constraint if exists works_venue_type_check;
alter table works add constraint works_venue_type_check
  check (
    venue_type is null
    or (kind = 'live' and venue_type in ('concert_hall', 'theater', 'livehouse', 'festival', 'arena'))
    or (kind = 'exhibition' and venue_type in ('museum', 'history_museum', 'gallery', 'special'))
  );
