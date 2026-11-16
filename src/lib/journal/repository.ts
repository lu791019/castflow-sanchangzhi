/** 視聽日誌資料存取（server only，走 service role；使用者端一律帶 userId 過濾） */

import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeByDay, totalsOf, type DaySummary, type MonthRange, type MonthTotals } from "./calendar";
import { buildDueReminders, buildPlanReminders, sameDaySiblings, toDueReminders, type DueCandidateRow, type DueReminder } from "./due";
import { computeRemindAt, PLAN_SETTLE_DELAY_MS, planRemindAt } from "./remind";
import {
  DEFAULT_REMINDER_TIMING,
  isReminderTiming,
  JOURNAL_COLUMNS,
  type JournalEntry,
  type ReminderTiming,
} from "./types";
import type { CreateJournalInput } from "./validate";

export const REMINDER_SETTINGS_KEY = "journal_reminder";
const DUE_BATCH_LIMIT = 50;

export class JournalNotFoundError extends Error {
  constructor(id: string) {
    super(`找不到日誌紀錄：${id}`);
    this.name = "JournalNotFoundError";
  }
}

/** 提醒設定以使用者分 key；沒設定過的人沿用單人時期的全域設定，再沒有用預設 */
export function reminderSettingsKey(userId: string): string {
  return `${REMINDER_SETTINGS_KEY}:${userId}`;
}

function timingOf(value: unknown): ReminderTiming | null {
  const timing = (value as { timing?: unknown } | undefined)?.timing;
  return isReminderTiming(timing) ? timing : null;
}

export async function getReminderTiming(userId: string): Promise<ReminderTiming> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [reminderSettingsKey(userId), REMINDER_SETTINGS_KEY]);
  if (error) throw new Error(`讀取提醒設定失敗：${error.message}`);
  const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
  const own = rows.find((row) => row.key === reminderSettingsKey(userId));
  const legacy = rows.find((row) => row.key === REMINDER_SETTINGS_KEY);
  return timingOf(own?.value) ?? timingOf(legacy?.value) ?? DEFAULT_REMINDER_TIMING;
}

export async function setReminderTiming(userId: string, timing: ReminderTiming): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("settings").upsert({
    key: reminderSettingsKey(userId),
    value: { timing },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`儲存提醒設定失敗：${error.message}`);
}

export async function createJournalEntry(
  userId: string,
  input: CreateJournalInput,
): Promise<JournalEntry> {
  // planned：當天早上提醒「今天的場」；散場後 settlePlans 轉 recorded 再依設定重算
  const remindAt =
    input.status === "planned" ? planRemindAt(input.experiencedAt) : computeRemindAt(input.experiencedAt, await getReminderTiming(userId));
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      work_id: input.workId,
      work_title_fallback: input.workTitle,
      experienced_at: input.experiencedAt.toISOString(),
      venue: input.venue,
      companions: input.companions,
      rating: input.rating,
      status: input.status,
      remind_at: remindAt ? remindAt.toISOString() : null,
    })
    .select(JOURNAL_COLUMNS)
    .single();
  if (error) throw new Error(`建立日誌紀錄失敗：${error.message}`);
  return data as JournalEntry;
}

/**
 * 同一部作品在 since 之後記過的最近一筆（UX-26）；沒有回 null。
 * 看過與排行程分開比：剛記完看過、再排下一場（或反過來）不算重複。
 */
export async function findRecentRepeat(userId: string, workId: string, since: Date, planned: boolean): Promise<Date | null> {
  const base = createAdminClient()
    .from("journal_entries")
    .select("created_at")
    .eq("user_id", userId)
    .eq("work_id", workId)
    .gte("created_at", since.toISOString());
  const { data, error } = await (planned ? base.eq("status", "planned") : base.neq("status", "planned"))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`讀取最近紀錄失敗：${error.message}`);
  return data ? new Date((data as { created_at: string }).created_at) : null;
}

export interface JournalMonth {
  month: string;
  entries: JournalEntry[];
  days: DaySummary[];
  totals: MonthTotals;
}

export async function listJournalMonth(userId: string, range: MonthRange): Promise<JournalMonth> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(JOURNAL_COLUMNS)
    .eq("user_id", userId)
    .gte("experienced_at", range.start.toISOString())
    .lt("experienced_at", range.end.toISOString())
    .order("experienced_at", { ascending: true });
  if (error) throw new Error(`讀取月份日誌失敗：${error.message}`);
  const entries = (data ?? []) as JournalEntry[];
  const days = summarizeByDay(entries);
  return { month: range.month, entries, days, totals: totalsOf(days) };
}

async function updateStatus(
  userId: string,
  id: string,
  patch: Partial<Pick<JournalEntry, "status" | "episode_id">>,
): Promise<JournalEntry> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select(JOURNAL_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`更新日誌紀錄失敗：${error.message}`);
  if (!data) throw new JournalNotFoundError(id);
  return data as JournalEntry;
}

/** 只記不說：之後不再提醒（worker 只撈 status=recorded） */
export function skipJournalEntry(userId: string, id: string): Promise<JournalEntry> {
  return updateStatus(userId, id, { status: "skipped" });
}

/** 說完一段後接線用：連結文章並標 said */
export function markJournalSaid(
  userId: string,
  id: string,
  episodeId: string,
): Promise<JournalEntry> {
  return updateStatus(userId, id, { status: "said", episode_id: episodeId });
}

const DUE_SELECT =
  "id, user_id, experienced_at, venue, status, remind_at, reminded_at, work_title_fallback, episode_id, works(title, kind, podcast_show)";
/** 同日提前帶出只看接下來一天內會到期的（同一個邏輯日的紀錄不會更晚） */
const SIBLING_LOOKAHEAD_MS = 36 * 60 * 60 * 1000;

/**
 * 排行程散場：experienced_at + 4 小時已過的 planned → recorded，remind_at 依該使用者設定重算、reminded_at 清掉，
 * 之後就走既有「想說說嗎？」。worker 每輪撈到期提醒前呼叫。回傳轉了幾筆
 */
export async function settlePlans(now: Date = new Date()): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(now.getTime() - PLAN_SETTLE_DELAY_MS).toISOString();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, user_id, experienced_at")
    .eq("status", "planned")
    .lte("experienced_at", cutoff)
    .limit(DUE_BATCH_LIMIT);
  if (error) throw new Error(`讀取待轉換的計畫失敗：${error.message}`);
  const rows = (data ?? []) as Array<{ id: string; user_id: string; experienced_at: string }>;
  const timings = new Map<string, ReminderTiming>();
  let settled = 0;
  for (const row of rows) {
    const timing = timings.get(row.user_id) ?? (await getReminderTiming(row.user_id));
    timings.set(row.user_id, timing);
    const remindAt = computeRemindAt(new Date(row.experienced_at), timing);
    const { error: updateError } = await supabase
      .from("journal_entries")
      .update({ status: "recorded", remind_at: remindAt ? remindAt.toISOString() : null, reminded_at: null })
      .eq("id", row.id)
      .eq("status", "planned");
    if (updateError) throw new Error(`計畫轉成已看失敗：${updateError.message}`);
    settled += 1;
  }
  return settled;
}

/** 排行程當天提醒（planned、remind_at 到期、未提醒） */
async function listDuePlans(now: Date): Promise<DueReminder[]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select(DUE_SELECT)
    .eq("status", "planned")
    .is("reminded_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", now.toISOString())
    .order("remind_at", { ascending: true })
    .limit(DUE_BATCH_LIMIT);
  if (error) throw new Error(`讀取當天提醒失敗：${error.message}`);
  return buildPlanReminders((data ?? []) as unknown as DueCandidateRow[], now);
}

/** 使用者「接下來」：還沒到的計畫，最近的在前 */
export async function listUpcomingPlans(userId: string, now: Date = new Date(), limit = 5): Promise<JournalEntry[]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select(JOURNAL_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "planned")
    .gte("experienced_at", new Date(now.getTime() - PLAN_SETTLE_DELAY_MS).toISOString())
    .order("experienced_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`讀取接下來的計畫失敗：${error.message}`);
  return (data ?? []) as JournalEntry[];
}

/** worker 用（x-api-key）：跨使用者撈到期提醒，每筆帶 userId 供 worker 只推給擁有者；同日未到期的一併帶出；排行程當天提醒一併回 */
export async function listDueReminders(now: Date = new Date()): Promise<DueReminder[]> {
  const plans = await listDuePlans(now);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(DUE_SELECT)
    .eq("status", "recorded")
    .is("reminded_at", null)
    .is("episode_id", null)
    .not("remind_at", "is", null)
    .lte("remind_at", now.toISOString())
    .order("remind_at", { ascending: true })
    .limit(DUE_BATCH_LIMIT);
  if (error) throw new Error(`讀取到期提醒失敗：${error.message}`);
  const dueRows = (data ?? []) as unknown as DueCandidateRow[];
  const due = toDueReminders(dueRows, now);
  if (due.length === 0) return [...plans, ...due];

  const { data: pending, error: pendingError } = await supabase
    .from("journal_entries")
    .select(DUE_SELECT)
    .in("user_id", [...new Set(due.map((reminder) => reminder.userId))])
    .eq("status", "recorded")
    .is("reminded_at", null)
    .is("episode_id", null)
    .gt("remind_at", now.toISOString())
    .lte("remind_at", new Date(now.getTime() + SIBLING_LOOKAHEAD_MS).toISOString())
    .limit(DUE_BATCH_LIMIT);
  // 帶不出同日紀錄只少了合併，到期的照樣提醒
  if (pendingError) {
    console.error("[journal:due] 讀取同日紀錄失敗", { message: pendingError.message });
    return [...plans, ...due];
  }
  const siblings = sameDaySiblings(dueRows, (pending ?? []) as unknown as DueCandidateRow[], now);
  return [...plans, ...due, ...buildDueReminders(siblings, now)];
}
