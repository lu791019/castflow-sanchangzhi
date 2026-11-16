/**
 * 日誌文案的共用字詞（純函式）：時段、相對日、間隔、作品類別、日期戳章。
 * 時段依設計稿「P1 元件特寫 04」：早上 5–11、中午 11–14、下午 14–18、晚上 18–23、深夜 23–5。
 * 「幾天後」以邏輯日（4 點換日）計算，見 time.ts。
 */

import { monthDayText } from "@/lib/format/digits";
import { logicalDayIndex, logicalDayParts, pad2, taipeiParts } from "./time";
import type { Venue } from "./types";

export type DayPeriod = "早上" | "中午" | "下午" | "晚上" | "深夜";

export function dayPeriod(date: Date): DayPeriod {
  const { hour } = taipeiParts(date);
  if (hour >= 5 && hour < 11) return "早上";
  if (hour >= 11 && hour < 14) return "中午";
  if (hour >= 14 && hour < 18) return "下午";
  if (hour >= 18 && hour < 23) return "晚上";
  return "深夜";
}

function isNight(period: DayPeriod): boolean {
  return period === "晚上" || period === "深夜";
}

/** 兩個時刻相隔幾個邏輯日（不為負） */
export function logicalDaysBetween(from: Date, to: Date): number {
  return Math.max(0, logicalDayIndex(to) - logicalDayIndex(from));
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 邏輯日的星期（凌晨 2 點算前一天） */
export function logicalWeekday(date: Date): string {
  const { year, month, day } = logicalDayParts(date);
  return `週${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}`;
}

/** 邏輯日 MM.DD */
export function logicalDateLabel(date: Date): string {
  const { month, day } = logicalDayParts(date);
  return `${pad2(month)}.${pad2(day)}`;
}

/**
 * 「什麼時候」的口語：以 now 為基準回頭看 experiencedAt。
 * 同一天：今晚／早上…；隔天：昨晚／昨天下午；2–6 天：週幾；更久：MM.DD
 */
export function relativeDayWord(experiencedAt: Date, now: Date): string {
  const days = logicalDaysBetween(experiencedAt, now);
  const period = dayPeriod(experiencedAt);
  if (days === 0) return isNight(period) ? "今晚" : period;
  if (days === 1) return isNight(period) ? "昨晚" : `昨天${period}`;
  if (days < 7) return logicalWeekday(experiencedAt);
  return logicalDateLabel(experiencedAt);
}

/** 「看完 1 天了」「隔了 2 天」裡的間隔（接在中文後時用 cjkSpacing 補空格） */
export function gapPhrase(days: number): string {
  if (days <= 0) return "半天";
  if (days >= 7) return "一陣子";
  return `${days} 天`;
}

export type WorkCategory = "screen" | "podcast" | "music" | "live" | "exhibition";

/** 作品類別：有作品看 works.kind，沒有（只記名稱）看場域 */
export function workCategory(kind: string | null | undefined, venue: Venue): WorkCategory {
  if (kind === "podcast_episode") return "podcast";
  if (kind === "music") return "music";
  if (kind === "live") return "live";
  if (kind === "exhibition") return "exhibition";
  if (kind === "movie" || kind === "series") return "screen";
  if (venue === "live") return "live";
  if (venue === "exhibition") return "exhibition";
  return "screen";
}

/** 日期戳章（邏輯日）：10/8 → 10 月 8 日 */
export function dateStamp(date: Date): string {
  const { month, day } = logicalDayParts(date);
  return monthDayText(month, day);
}
