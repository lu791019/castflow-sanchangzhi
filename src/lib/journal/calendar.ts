/** 月曆用：月份範圍與每日彙總（純函式，日期以台北日曆日歸屬） */

import { fromTaipei, pad2, taipeiDateKey } from "./time";
import type { JournalEntry, JournalStatus, Venue } from "./types";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export interface MonthRange {
  month: string;
  start: Date;
  end: Date;
}

/** "2026-10" → 台北 10/1 00:00 ~ 11/1 00:00（半開區間）；格式錯回 null */
export function parseMonth(value: string | null | undefined): MonthRange | null {
  const match = value ? MONTH_PATTERN.exec(value) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 1900 || year > 2100) return null;
  return {
    month: `${year}-${pad2(month)}`,
    start: fromTaipei(year, month, 1),
    end: fromTaipei(year, month + 1, 1),
  };
}

export function currentMonth(now: Date = new Date()): string {
  return taipeiDateKey(now).slice(0, 7);
}

export interface DaySummary {
  date: string;
  count: number;
  said: number;
  recorded: number;
  skipped: number;
  planned: number;
  venues: Venue[];
  entryIds: string[];
}

type SummarySource = Pick<JournalEntry, "id" | "experienced_at" | "venue" | "status">;

function emptyDay(date: string): DaySummary {
  return { date, count: 0, said: 0, recorded: 0, skipped: 0, planned: 0, venues: [], entryIds: [] };
}

function addToDay(day: DaySummary, entry: SummarySource): DaySummary {
  const status: JournalStatus = entry.status;
  return {
    ...day,
    count: day.count + 1,
    said: day.said + (status === "said" ? 1 : 0),
    recorded: day.recorded + (status === "recorded" ? 1 : 0),
    skipped: day.skipped + (status === "skipped" ? 1 : 0),
    planned: day.planned + (status === "planned" ? 1 : 0),
    venues: day.venues.includes(entry.venue) ? day.venues : [...day.venues, entry.venue],
    entryIds: [...day.entryIds, entry.id],
  };
}

/** 依台北日曆日彙總；只回有紀錄的日子，日期遞增排序 */
export function summarizeByDay(entries: readonly SummarySource[]): DaySummary[] {
  const byDate = entries.reduce<ReadonlyMap<string, DaySummary>>((acc, entry) => {
    const date = taipeiDateKey(new Date(entry.experienced_at));
    const next = new Map(acc);
    next.set(date, addToDay(acc.get(date) ?? emptyDay(date), entry));
    return next;
  }, new Map());
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthTotals {
  count: number;
  said: number;
  recorded: number;
  skipped: number;
  activeDays: number;
}

export function totalsOf(days: readonly DaySummary[]): MonthTotals {
  return days.reduce<MonthTotals>(
    (acc, day) => ({
      count: acc.count + day.count,
      said: acc.said + day.said,
      recorded: acc.recorded + day.recorded,
      skipped: acc.skipped + day.skipped,
      activeDays: acc.activeDays + 1,
    }),
    { count: 0, said: 0, recorded: 0, skipped: 0, activeDays: 0 },
  );
}
