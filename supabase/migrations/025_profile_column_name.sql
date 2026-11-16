-- 025 作者專欄名
-- profiles.column_name：作者自己取的專欄名（索引作者列、搜尋作者列、作者專欄頁、我的頁刊頭）。
--   null = 沒取；畫面上就不顯示專欄名那一行（不給預設名）。
--   規則與 src/lib/me/column-name.ts 一致：去頭尾空白、內部連續空白收成一格、1–20 字、不含控制字元。
--   寫入只經 server（service role，lib/me/column-name-repository.ts）；RLS 沿用 017（登入者只能讀自己，不能直接寫）。
-- 冪等可重複執行。

alter table profiles
  add column if not exists column_name text;

alter table profiles
  drop constraint if exists profiles_column_name_shape;

alter table profiles
  add constraint profiles_column_name_shape
    check (
      column_name is null
      or (
        column_name = btrim(column_name)
        and char_length(column_name) between 1 and 20
        and column_name !~ '[[:cntrl:]]'
      )
    );
