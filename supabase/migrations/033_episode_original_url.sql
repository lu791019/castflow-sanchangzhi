-- 033：部落格文章匯入（10/14）——記下原文網址
-- * episodes.original_url：匯入文章的原文網址（已正規化：https、去追蹤參數與 #）；一般文章為 null
-- * 同一使用者同一原文網址只能匯入一次（部分唯一索引；並發送出時由 DB 擋第二筆）
-- * RLS 照 episodes 既有 policy（欄位層級不另開；公開頁一律走 service role 讀）
-- 冪等：可重複執行

alter table episodes
  add column if not exists original_url text;

alter table episodes drop constraint if exists episodes_original_url_check;
alter table episodes
  add constraint episodes_original_url_check
  check (original_url is null or (original_url ~ '^https://' and char_length(original_url) <= 2000));

create unique index if not exists episodes_user_original_url_key
  on episodes (user_id, original_url)
  where original_url is not null;
