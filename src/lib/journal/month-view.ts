/** 日誌頁讀取（server only，走 service role；一律帶 userId 過濾） */

import { createAdminClient } from "@/lib/supabase/admin";
import type { MonthRange } from "./calendar";
import type { JournalViewEntry } from "./view";
import { JOURNAL_VIEW_SELECT, toJournalViewEntry, type JournalViewRow } from "./view-row";

const UPCOMING_LIMIT = 5;
/** 場次開始後 4 小時內還算「接下來」（與 repository.settlePlans 的轉換時點一致） */
const UPCOMING_GRACE_MS = 4 * 60 * 60 * 1000;

function toEntries(rows: JournalViewRow[]): JournalViewEntry[] {
  return rows.flatMap((row) => {
    const entry = toJournalViewEntry(row);
    if (!entry) console.error("[journal] 略過不合法的日誌列", { id: row.id, venue: row.venue, status: row.status });
    return entry ? [entry] : [];
  });
}

/** 「接下來」：排好還沒到的計畫（跨月），最近的在前 */
export async function loadUpcomingPlansView(userId: string, now: Date, limit = UPCOMING_LIMIT): Promise<JournalViewEntry[]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select(JOURNAL_VIEW_SELECT)
    .eq("user_id", userId)
    .eq("status", "planned")
    .gte("experienced_at", new Date(now.getTime() - UPCOMING_GRACE_MS).toISOString())
    .order("experienced_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`讀取接下來的計畫失敗：${error.message}`);
  return toEntries((data ?? []) as unknown as JournalViewRow[]);
}

export async function loadJournalMonthView(userId: string, range: MonthRange): Promise<JournalViewEntry[]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select(JOURNAL_VIEW_SELECT)
    .eq("user_id", userId)
    .gte("experienced_at", range.start.toISOString())
    .lt("experienced_at", range.end.toISOString())
    .order("experienced_at", { ascending: true });
  if (error) throw new Error(`讀取日誌失敗：${error.message}`);
  return toEntries((data ?? []) as unknown as JournalViewRow[]);
}
