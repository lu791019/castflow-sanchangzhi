/**
 * 同場的時間窗（台北時間）：
 * - time.week：本週＝週一 00:00 至今（作品特輯「這週散場的人」「本週」分段）
 * - sameShow.window：近 7 天（含今天，文章頁「這週也看了《X》的人」）
 */

import { fromTaipei, taipeiParts } from "@/lib/journal/time";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 台北週一 00:00 */
export function thisWeekStart(now: Date): Date {
  const { year, month, day } = taipeiParts(now);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0＝週日
  const sinceMonday = (weekday + 6) % 7;
  return fromTaipei(year, month, day - sinceMonday);
}

/** 今天往前六天的 00:00（台北），共 7 天 */
export function lastSevenDaysStart(now: Date): Date {
  const { year, month, day } = taipeiParts(now);
  return fromTaipei(year, month, day - 6);
}

export function dayLabel(date: Date): string {
  const { month, day } = taipeiParts(date);
  return `${pad2(month)}.${pad2(day)}`;
}

/** MM.DD{sep}MM.DD；同一天只寫一個 */
export function formatDayRange(from: Date, to: Date, separator: string): string {
  const start = dayLabel(from);
  const end = dayLabel(to);
  return start === end ? start : `${start}${separator}${end}`;
}

export function isWithin(iso: string, since: Date): boolean {
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time >= since.getTime();
}
