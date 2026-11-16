-- 多來源藝文活動（Q-62，10/15）：Mac worker 每天從 KKTIX／OPENTIX／Accupass／北美館收活動，走 POST /api/events/ingest 寫入。
-- Cloud Run 只讀這張表（散場之前），請求時不爬。
-- 1. 同來源同一筆只留一列：unique(source, source_id)，重收就更新。
-- 2. norm_key＝標題正規化＋起始日＋場地正規化（src/lib/events/collected.ts）；多來源同一活動 ingest 時把 ticket_urls 聯集到每一列，讀取時同 norm_key 只取一張。
-- 3. category 細類（音樂會、舞台劇、舞蹈、音樂祭…）；kind 兩大類（演出 live／展覽 exhibition）由 category 推出。
-- 4. show_times：[{ "date": "YYYY-MM-DD", "time": "HH:MM" | null }]；ticket_urls：[{ "source": "kktix", "url": "https://…" }]。
-- RLS 開啟、不給 anon／authenticated 任何權限：只走 server（service role），同 episode_embeddings。
-- 冪等可重複執行。

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('kktix', 'opentix', 'accupass', 'tfam')),
  source_id text not null check (char_length(source_id) between 1 and 200),
  title text not null check (char_length(title) between 1 and 200),
  category text not null check (category in ('performance', 'concert', 'festival', 'theatre', 'dance', 'exhibition')),
  kind text generated always as (case when category = 'exhibition' then 'exhibition' else 'live' end) stored,
  venue text check (venue is null or char_length(venue) between 1 and 200),
  city text check (city is null or char_length(city) between 1 and 20),
  starts_on date not null,
  ends_on date not null,
  show_times jsonb not null default '[]'::jsonb check (jsonb_typeof(show_times) = 'array'),
  ticket_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(ticket_urls) = 'array'),
  image_url text check (image_url is null or (image_url ~* '^https://' and char_length(image_url) <= 2000)),
  source_url text not null check (source_url ~* '^https://' and char_length(source_url) <= 2000),
  norm_key text not null check (char_length(norm_key) between 1 and 300),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id),
  check (ends_on >= starts_on)
);

-- 散場之前：結束日不早於今天、開始日不晚於窗尾
create index if not exists idx_events_window on events(ends_on, starts_on);
create index if not exists idx_events_norm_key on events(norm_key);

alter table events enable row level security;
revoke all on events from anon, authenticated;
