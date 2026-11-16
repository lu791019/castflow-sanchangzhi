-- Podcast 單集閱讀頁需要的 RSS 節目／單集資料（data-feasibility.md 第三節）
-- - 節目封面一律用 channel itunes:image（單集封面常缺）→ feeds.image_url
-- - 作者照實存 RSS itunes:author（節目層級 + 單集層級，單集優先），文案不寫「主持人」
-- - 集數：itunes:episode 不可靠，缺就留 null 不顯示；有 itunes:season 時是季內集數
-- - 播出日期另開 aired_at：episodes.published_at 是「感受發佈時間」，不可混用
-- 冪等：可重複執行

alter table feeds
  add column if not exists image_url text;

alter table feeds
  add column if not exists author text;

alter table episodes
  add column if not exists aired_at timestamptz;

alter table episodes
  add column if not exists episode_number integer;

alter table episodes
  add column if not exists season_number integer;

alter table episodes
  add column if not exists author text;

alter table episodes
  drop constraint if exists episodes_episode_number_positive;

alter table episodes
  add constraint episodes_episode_number_positive
  check (episode_number is null or episode_number > 0);

alter table episodes
  drop constraint if exists episodes_season_number_positive;

alter table episodes
  add constraint episodes_season_number_positive
  check (season_number is null or season_number > 0);
