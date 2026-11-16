-- 視聽日誌與提醒通知
-- 「記一筆」（作品、時間、場域）與「說一段」分開：記完可只記不說；
-- remind_at 由 app 依提醒設定算好寫入，worker 每輪撈到期且未提醒的紀錄發通知。
-- 提醒設定存既有 settings key-value 表（key = 'journal_reminder'），不另開欄位。

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references works(id) on delete set null,
  work_title_fallback text,
  experienced_at timestamptz not null,
  venue text not null default 'other',
  companions text,
  status text not null default 'recorded',
  episode_id uuid references episodes(id) on delete set null,
  remind_at timestamptz,
  reminded_at timestamptz,
  user_id text not null default 'default',
  created_at timestamptz not null default now(),
  constraint journal_entries_venue_check
    check (venue in ('home', 'cinema', 'live', 'exhibition', 'commute', 'other')),
  constraint journal_entries_status_check
    check (status in ('recorded', 'said', 'skipped')),
  -- 只記名稱也行，但至少要有作品或名稱其一
  constraint journal_entries_work_present
    check (work_id is not null or length(btrim(coalesce(work_title_fallback, ''))) > 0),
  constraint journal_entries_title_length
    check (work_title_fallback is null or char_length(work_title_fallback) <= 200),
  constraint journal_entries_companions_length
    check (companions is null or char_length(companions) <= 200)
);

create index if not exists idx_journal_entries_experienced_at
  on journal_entries(user_id, experienced_at);

-- worker 撈到期提醒專用
create index if not exists idx_journal_entries_due
  on journal_entries(remind_at)
  where status = 'recorded' and reminded_at is null and remind_at is not null;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'say_reminder',
  journal_entry_id uuid references journal_entries(id) on delete cascade,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  user_id text not null default 'default',
  created_at timestamptz not null default now(),
  constraint notifications_kind_check check (kind in ('say_reminder')),
  -- 同一筆紀錄的同類提醒只會有一則（worker 重跑冪等；null 彼此不衝突）
  constraint uq_notifications_entry_kind unique (journal_entry_id, kind)
);

create index if not exists idx_notifications_created_at
  on notifications(user_id, created_at desc);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text,
  user_id text not null default 'default',
  created_at timestamptz not null default now(),
  constraint push_subscriptions_keys_shape
    check (keys ? 'p256dh' and keys ? 'auth')
);
