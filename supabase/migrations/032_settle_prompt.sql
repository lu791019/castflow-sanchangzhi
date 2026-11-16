-- 散場當下提醒（Dex 10/14，Q-37）：排了行程的人，散場那一刻問一句「散場了？」
-- notifications.kind 加 'settle_prompt'（照 026 的寫法換 check constraint）；
-- 與 say_reminder／plan_reminder 分開，unique(journal_entry_id, kind) 不衝突 → 同一條目只會有一則（worker 重跑冪等）。
-- works.runtime_minutes：TMDB 片長（分），估散場時間用；沒有時 app 端預設 130 分。

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('say_reminder', 'plan_reminder', 'settle_prompt'));

alter table works add column if not exists runtime_minutes integer;
alter table works drop constraint if exists works_runtime_minutes_range;
alter table works add constraint works_runtime_minutes_range
  check (runtime_minutes is null or (runtime_minutes > 0 and runtime_minutes <= 1000));

-- 撈散場候選：近 36 小時的計畫（planned 與已轉 recorded 的）
create index if not exists idx_journal_entries_settle
  on journal_entries(experienced_at)
  where status in ('planned', 'recorded') and episode_id is null;
