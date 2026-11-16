-- 校樣（發佈前確認頁）：發佈設定 + 選定引言
-- AI 原版沿用 contents.original_body（003 已存在：生成時寫入、編輯只改 body），
-- 校樣以「body vs original_body」逐段比對判斷「已修改・還原」，不另開欄位。
-- 冪等：可重複執行

-- 公開範圍：public 進目錄與作品特輯；unlisted 只給有連結的人；private 只存在我的專欄
alter table episodes
  add column if not exists visibility text not null default 'public';
alter table episodes drop constraint if exists episodes_visibility_check;
alter table episodes
  add constraint episodes_visibility_check
  check (visibility in ('public', 'unlisted', 'private'));

-- 署名：筆名 / 匿名
alter table episodes
  add column if not exists byline text not null default 'pen_name';
alter table episodes drop constraint if exists episodes_byline_check;
alter table episodes
  add constraint episodes_byline_check
  check (byline in ('pen_name', 'anonymous'));

-- 同時產生 6 平台貼文（關閉時發佈會清掉社群草稿）
alter table episodes
  add column if not exists generate_social boolean not null default true;

-- 發佈時間：null = 草稿
alter table episodes
  add column if not exists published_at timestamptz;

-- 作者選定的引言（分享頁 pull quote、作品特輯共鳴句；null 時 fallback 自動抽句）
alter table episodes
  add column if not exists pull_quote text;

-- 引擎挑出的 3 句候選（快取，重新整理一版時清空）
alter table episodes
  add column if not exists quote_candidates jsonb;

-- 既有已公開（有 share_slug）的集數視為已發佈
update episodes
  set published_at = created_at
  where share_slug is not null and published_at is null;

create index if not exists idx_episodes_published
  on episodes(visibility, published_at desc)
  where published_at is not null;
