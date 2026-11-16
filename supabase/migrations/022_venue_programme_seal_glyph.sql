-- 022 場外場刊與印文
-- 1. 場外（演出 live／展覽 exhibition）沿用 014 的 kind、venue、event_date，不另開 kind。
--    event_end_date：展期或多日音樂祭的最後一天；單日演出為 null（= event_date）。
--    live_key：名稱正規化後的比對鍵（src/lib/venue/name.ts 產生），「同名＋日期重疊」歸入同一本場刊。
-- 2. profiles.seal_glyph：作者在設定換的印文用字；null = 依規則。
--    「必須是筆名中的字」由 server 驗證（改筆名後舊字不在筆名裡時，印章規則會自動忽略），DB 只擋長度。
-- 冪等可重複執行。

alter table works
  add column if not exists event_end_date date;

alter table works
  drop constraint if exists works_event_range_check;

alter table works
  add constraint works_event_range_check
    check (event_end_date is null or (event_date is not null and event_end_date >= event_date));

alter table works
  add column if not exists live_key text;

alter table works
  drop constraint if exists works_live_key_length;

alter table works
  add constraint works_live_key_length
    check (live_key is null or char_length(live_key) between 1 and 200);

create index if not exists idx_works_live_key
  on works (kind, live_key)
  where live_key is not null;

alter table profiles
  add column if not exists seal_glyph text;

alter table profiles
  drop constraint if exists profiles_seal_glyph_shape;

alter table profiles
  add constraint profiles_seal_glyph_shape
    check (seal_glyph is null or (char_length(seal_glyph) = 1 and seal_glyph !~ '[[:space:][:cntrl:]]'));
