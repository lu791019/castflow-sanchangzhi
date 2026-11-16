-- 資料面：在哪看快取、手動作品補資料狀態、演出／展覽作品
-- 冪等可重複執行；不依賴 013

-- 1. 在哪看（TMDB watch providers，TW）快取：jsonb 存 {providers, link, releaseDate}，24 小時 TTL 由 app 判斷
alter table works
  add column if not exists watch_providers jsonb;

alter table works
  add column if not exists watch_providers_checked_at timestamptz;

-- 2. 手動作品補資料（worker enrich job）：判定過就不再重打 TMDB
alter table works
  add column if not exists enrich_status text;

alter table works
  drop constraint if exists works_enrich_status_check;

alter table works
  add constraint works_enrich_status_check
    check (enrich_status is null or enrich_status in ('done', 'ambiguous', 'not_found', 'duplicate'));

create index if not exists idx_works_enrich_pending
  on works (created_at)
  where tmdb_id is null and enrich_status is null and kind in ('movie', 'series');

-- 3. 演出（音樂祭／演出）、展覽
alter table works
  drop constraint if exists works_kind_check;

alter table works
  add constraint works_kind_check
    check (kind in ('movie', 'series', 'podcast_episode', 'live', 'exhibition'));

alter table works
  add column if not exists venue text;

alter table works
  add column if not exists event_date date;
