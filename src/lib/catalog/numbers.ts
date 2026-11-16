/**
 * 索引的日期工具。數量一律阿拉伯數字（10/11 Dex 拍板，取代 Token「number.style」的國字），見 lib/format/digits。
 */

import { fromTaipei, pad2, taipeiParts } from "@/lib/journal/time";

/** 台北時間的 MM.DD（統計欄、最近一篇） */
export function dotDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const { month, day } = taipeiParts(date);
  return `${pad2(month)}.${pad2(day)}`;
}

/** 本週起點：台北週一 00:00（Token「time.week」） */
export function taipeiWeekStart(now: Date): Date {
  const { year, month, day } = taipeiParts(now);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const sinceMonday = (weekday + 6) % 7;
  return fromTaipei(year, month, day - sinceMonday, 0, 0);
}
