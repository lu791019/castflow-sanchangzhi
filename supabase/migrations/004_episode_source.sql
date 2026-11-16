-- Episode source: 'audio'（上傳/RSS 音訊）或 'text'（貼上文字，跳過轉錄）
-- 文字來源沒有音訊檔，audio_url 改為可空

alter table episodes
  add column if not exists source text not null default 'audio';

alter table episodes
  alter column audio_url drop not null;

alter table episodes
  drop constraint if exists episodes_source_check;

alter table episodes
  add constraint episodes_source_check
  check (source in ('audio', 'text', 'rss'));
