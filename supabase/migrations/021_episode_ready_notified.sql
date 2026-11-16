-- 說一段整理好（轉成文字）時推一則「整理好了」：worker 每輪撈未通知的集數推播，寫入時間防重推。
-- 只推播、不進收件匣（收件匣只放「隔天問你一次」的提醒）。
alter table episodes add column if not exists ready_notified_at timestamptz;

-- 既有集數視為已通知，避免上線後第一輪把舊錄音全推一遍
update episodes set ready_notified_at = now() where ready_notified_at is null;

create index if not exists idx_episodes_ready_pending
  on episodes(created_at)
  where source = 'audio' and status = 'transcribed' and ready_notified_at is null;
