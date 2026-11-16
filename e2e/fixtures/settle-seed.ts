/**
 * 散場當下提醒 E2E：以 service role 直接種「已排行程、場次已過」的日誌，並用 worker 本身的派送程式建通知
 * （不推播、只處理本測試的條目，避免動到其他人的資料）。
 */

import { createDb, insertReminderNotification, markJournalReminded } from "../../worker/db.ts";
import { processReminders, type DueReminder, type ReminderRunResult } from "../../worker/reminders.ts";
import { serviceRoleKey, supabaseUrl } from "./env";

const HOUR = 60 * 60 * 1000;

async function insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`[settle seed] insert ${table} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [created] = (await response.json()) as T[];
  return created;
}

/** 前一天排好、hoursAgo 小時前開演的電影院場次（當天提醒已送過） */
export async function seedPlannedScreening(userId: string, workId: string, hoursAgo: number): Promise<string> {
  const now = Date.now();
  const row = await insert<{ id: string }>("journal_entries", {
    user_id: userId,
    work_id: workId,
    experienced_at: new Date(now - hoursAgo * HOUR).toISOString(),
    created_at: new Date(now - 26 * HOUR).toISOString(),
    venue: "cinema",
    status: "planned",
    remind_at: new Date(now - (hoursAgo + 2) * HOUR).toISOString(),
    reminded_at: new Date(now - (hoursAgo + 2) * HOUR).toISOString(),
  });
  return row.id;
}

/** 使用者自己寫的一篇（綁同作品）：模擬散場前已經說過 */
export async function seedOwnEpisode(userId: string, workId: string): Promise<string> {
  const row = await insert<{ id: string }>("episodes", {
    user_id: userId,
    title: "散場前就先說了",
    source: "text",
    status: "transcribed",
    work_id: workId,
  });
  return row.id;
}

/** 跑 worker 的提醒派送，只處理指定條目；推播未設定（sendPush null），收集警報 */
export async function runWorkerFor(
  reminders: readonly DueReminder[],
  entryId: string,
): Promise<{ result: ReminderRunResult; alerts: string[]; marked: string[] }> {
  const db = createDb(supabaseUrl(), serviceRoleKey());
  const alerts: string[] = [];
  const marked: string[] = [];
  const result = await processReminders({
    fetchDue: async () => reminders.filter((reminder) => reminder.journalEntryId === entryId),
    createNotification: (reminder) => insertReminderNotification(db, reminder),
    listSubscriptions: async () => [],
    sendPush: null,
    removeSubscription: async () => undefined,
    markReminded: async (id) => {
      marked.push(id);
      await markJournalReminded(db, id);
    },
    notify: async (level, title, detail) => {
      alerts.push(`${level}:${title}`);
      return { at: new Date().toISOString(), level, title, detail: detail ?? "" };
    },
  });
  return { result, alerts, marked };
}
