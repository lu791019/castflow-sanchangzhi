-- 公開分享頁：episodes.share_slug 有值即公開（nullable；以 slug 查詢，unique 兼作索引）

alter table episodes
  add column if not exists share_slug text unique;
