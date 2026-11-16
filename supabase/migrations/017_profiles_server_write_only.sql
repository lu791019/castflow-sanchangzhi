-- 筆名只經 server（service role，lib/me/pen-name.ts）寫入：app 端有唯一性、長度、控制字元等檢查。
-- 015 開放登入者直接 insert/update 自己的 profiles，等於可繞過 app 檢查直接改筆名 → 收回，只保留讀自己的。
drop policy if exists profiles_self_insert on profiles;
drop policy if exists profiles_self_update on profiles;
revoke insert, update on profiles from anon, authenticated;

-- DB 層也擋控制字元（換行、tab 等），即使日後有其他寫入路徑
alter table profiles drop constraint if exists profiles_pen_name_no_control;
alter table profiles add constraint profiles_pen_name_no_control
  check (pen_name is null or pen_name !~ '[[:cntrl:]]');
