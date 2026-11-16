-- 音樂作品（Q-61，10/15）：works.kind 加 music（專輯）
--   欄位沿用既有：title＝專輯名、credit＝歌手／樂團、year＝發行年、poster_url＝專輯封面、itunes_id＝iTunes collectionId
-- itunes_id 改 bigint：Apple Music 新專輯的 id 已超過 integer 上限（實測 6812635395）
-- 同一張專輯以 itunes_id 判同一張（唯一索引，只管 music）
-- 冪等可重複執行

alter table works
  drop constraint if exists works_kind_check;

alter table works
  add constraint works_kind_check
    check (kind in ('movie', 'series', 'podcast_episode', 'live', 'exhibition', 'music'));

alter table works
  alter column itunes_id type bigint;

create unique index if not exists works_music_itunes_id_key
  on works (itunes_id)
  where kind = 'music' and itunes_id is not null;
