-- 作品選擇器：外部來源對應鍵（去重用）
-- - 電影／影集：以 (kind, tmdb_id) 判同一部（TMDB movie / tv 的 id 是兩個號碼空間，不能只看 tmdb_id）
-- - Podcast 單集：以 (feed_url, episode_guid) 判同一集；itunes_id 僅供顯示／回查節目
-- 全部 nullable，不改既有 check；冪等可重複執行

alter table works
  add column if not exists feed_url text;

alter table works
  add column if not exists itunes_id integer;

alter table works
  add column if not exists episode_guid text;

create unique index if not exists works_kind_tmdb_id_key
  on works (kind, tmdb_id)
  where tmdb_id is not null;

create unique index if not exists works_feed_episode_key
  on works (feed_url, episode_guid)
  where feed_url is not null and episode_guid is not null;
