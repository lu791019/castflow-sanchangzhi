/** /journal 與 /journal/new 共用：解析網址參數、讀當月紀錄、筆名、未讀數（一律限本人） */

import { currentMonth, parseMonth } from "@/lib/journal/calendar";
import { loadJournalMonthView, loadUpcomingPlansView } from "@/lib/journal/month-view";
import { loadUpcomingLinks } from "@/lib/links/upcoming";
import { adjacentMonth } from "@/lib/journal/view";
import { loadColumnName } from "@/lib/me/column-name-repository";
import { loadPenName } from "@/lib/me/pen-name";
import { countUnreadNotifications } from "@/lib/notifications/repository";
import type { JournalScreenProps } from "./journal-screen";

export interface JournalSearchParams {
  month?: string | string[];
  view?: string | string[];
  day?: string | string[];
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_MONTHS_AHEAD = 12;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function unreadOrZero(userId: string): Promise<number> {
  try {
    return await countUnreadNotifications(userId);
  } catch (error) {
    console.error("[journal] 讀取未讀數失敗", error instanceof Error ? error.message : error);
    return 0;
  }
}

export async function loadJournalScreen(userId: string, params: JournalSearchParams): Promise<JournalScreenProps> {
  const now = new Date();
  const thisMonth = currentMonth(now);
  // 排行程最遠一年：月份可往後翻到 12 個月後
  const requested = parseMonth(first(params.month));
  const range = requested && requested.month <= adjacentMonth(thisMonth, MAX_MONTHS_AHEAD) ? requested : parseMonth(thisMonth);
  if (!range) throw new Error(`月份解析失敗：${thisMonth}`);
  const day = first(params.day);
  const query = {
    month: range.month,
    view: first(params.view) === "list" ? ("list" as const) : ("cal" as const),
    day: day && DAY_PATTERN.test(day) && day.startsWith(range.month) ? day : null,
  };
  const [entries, { upcoming, upcomingLinks }, penName, unreadCount, columnName] = await Promise.all([
    loadJournalMonthView(userId, range),
    loadUpcomingPlansView(userId, now).then(async (upcoming) => ({
      upcoming,
      upcomingLinks: await loadUpcomingLinks(userId, upcoming.map((entry) => entry.id)),
    })),
    loadPenName(userId),
    unreadOrZero(userId),
    loadColumnName(userId),
  ]);
  return { query, currentMonth: thisMonth, entries, upcoming, upcomingLinks, penName, columnName, unreadCount, now };
}
