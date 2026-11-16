-- 閱讀引擎產出（Phase 1e）：每集一列，存雙語分段陣列 + 摘要 + 章節
-- 閱讀頁一次取整份（依 episode_id），不做逐段 row → 用 jsonb 陣列
-- 冪等：可重複執行

create table if not exists episode_readings (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null unique references episodes(id) on delete cascade,
  -- 產出所依據的逐字稿（重新轉錄後可判斷是否過期）
  transcript_id uuid references transcripts(id) on delete set null,
  -- pending：產生中；ready：完成；error：失敗（error_message 有原因）；skipped：中文節目不需雙語
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'error', 'skipped')),
  source_language text not null,
  target_language text not null default 'zh-TW',
  -- [{start, end, speaker?, source_text, source_lang, translated_text}]
  segments jsonb not null default '[]',
  -- ["重點 1", …]（3–5 條）
  summary jsonb not null default '[]',
  -- [{title, start}]
  chapters jsonb not null default '[]',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_episode_readings_status on episode_readings(status);
