-- 排行程（Dex 10/13）：日誌可記「計畫中」的未來場次
-- status 'planned'：experienced_at 在未來；remind_at 是當天早上 9 點的「今天的場」提醒；
-- 場次過後（experienced_at + 4 小時）由 app 在 worker 撈到期提醒時自動轉成 recorded，
-- 重算 remind_at 走既有「想說說嗎？」流程。
-- notifications.kind 加 'plan_reminder'（當天提醒），與 say_reminder 分開，unique(journal_entry_id, kind) 不衝突。

alter table journal_entries drop constraint if exists journal_entries_status_check;
alter table journal_entries add constraint journal_entries_status_check
  check (status in ('planned', 'recorded', 'said', 'skipped'));

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('say_reminder', 'plan_reminder'));

-- 撈待轉換的計畫（場次已過）與使用者「接下來」清單
create index if not exists idx_journal_entries_planned
  on journal_entries(experienced_at)
  where status = 'planned';
