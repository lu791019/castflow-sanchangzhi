-- RSS 訂閱：feeds 表 + episodes 關聯（feed_id + guid 供 feed 內去重）

create table if not exists feeds (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table episodes
  add column if not exists feed_id uuid references feeds(id) on delete set null;

alter table episodes
  add column if not exists guid text;

-- 同一 feed 內同 guid 不重複建集（兩欄皆有值時才約束）
create unique index if not exists idx_episodes_feed_guid
  on episodes(feed_id, guid)
  where feed_id is not null and guid is not null;
