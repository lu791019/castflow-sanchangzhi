-- 封面補齊（Dex 10/13 晚：海報要留但不能空）
-- 1. Storage `covers` 桶：場刊手填封面的上傳檔。公開讀（<img> 直接用 public URL），
--    寫入只走 server（service role，/api/covers 驗登入、類型與大小）；登入者與匿名都不能直接寫。
--    限 jpg/png/webp、≤3MB（桶層再擋一次，與 API 一致）。
-- 2. works.cover_checked_at：worker 補封面（podcast 既有作品 lookup iTunes → RSS）查過但仍沒有圖的時間，
--    避免每輪重掃同一批；過一段時間（見 src/lib/covers/backfill.ts）再試。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists covers_public_read on storage.objects;
create policy covers_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'covers');

alter table works add column if not exists cover_checked_at timestamptz;

create index if not exists works_cover_pending_idx
  on works (cover_checked_at nulls first, created_at)
  where poster_url is null and kind = 'podcast_episode';
