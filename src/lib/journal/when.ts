/** 記一筆「什麼時候」：快速選項換算成 experienced_at 與日期章文字（純函式，台北時間） */

import { DAY_START_HOUR, fromTaipei, logicalDayParts, pad2, taipeiParts } from "./time";

export type WhenChoice = "now" | "earlier" | "yesterday" | "custom";

export const WHEN_OPTIONS: ReadonlyArray<{ value: WhenChoice; label: string }> = [
  { value: "now", label: "剛剛" },
  { value: "earlier", label: "今天稍早" },
  { value: "yesterday", label: "昨天" },
  { value: "custom", label: "選日期時間" },
];

/** 選日期時間可以選未來（排行程，Dex 10/13）：最遠一年；10 分鐘內視為「剛剛」不算計畫 */
export const PLAN_TOLERANCE_MS = 10 * 60 * 1000;
export const MAX_PLAN_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export function isPlannedAt(at: Date, now: Date): boolean {
  return at.getTime() > now.getTime() + PLAN_TOLERANCE_MS;
}

/** 今天稍早＝往前 3 小時；昨天＝前一晚 21:00 */
const EARLIER_MS = 3 * 60 * 60 * 1000;
const YESTERDAY_HOUR = 21;

export interface ResolvedWhen {
  /** null = 選日期時間但還沒選好 */
  at: Date | null;
  stampDate: string;
  stampTime: string;
}

const PENDING: ResolvedWhen = { at: null, stampDate: "──", stampTime: "請選擇" };
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function stampDateOf(date: Date): string {
  const { month, day } = taipeiParts(date);
  return `${pad2(month)}.${pad2(day)}`;
}

function clockOf(date: Date): string {
  const { hour, minute } = taipeiParts(date);
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** datetime-local 的值（視為台北牆上時間）→ Date；不合法回 null */
export function parseTaipeiLocal(value: string | null | undefined): Date | null {
  const match = value ? LOCAL_PATTERN.exec(value) : null;
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = fromTaipei(year, month, day, hour, minute);
  return taipeiParts(date).day === day ? date : null;
}

export function toTaipeiLocalInput(date: Date): string {
  const { year, month, day } = taipeiParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}T${clockOf(date)}`;
}

export function resolveWhen(choice: WhenChoice, now: Date, custom?: string): ResolvedWhen {
  switch (choice) {
    case "now":
      return { at: now, stampDate: stampDateOf(now), stampTime: clockOf(now) };
    case "earlier": {
      const { year, month, day } = logicalDayParts(now);
      const dayStart = fromTaipei(year, month, day, DAY_START_HOUR);
      const at = new Date(Math.max(now.getTime() - EARLIER_MS, dayStart.getTime()));
      return { at, stampDate: stampDateOf(at), stampTime: "稍早" };
    }
    case "yesterday": {
      const { year, month, day } = logicalDayParts(now);
      const at = fromTaipei(year, month, day - 1, YESTERDAY_HOUR);
      return { at, stampDate: stampDateOf(at), stampTime: "晚上" };
    }
    case "custom": {
      const at = parseTaipeiLocal(custom);
      if (!at || at.getTime() > now.getTime() + MAX_PLAN_AHEAD_MS) return PENDING;
      return { at, stampDate: stampDateOf(at), stampTime: isPlannedAt(at, now) ? `${clockOf(at)} 計畫` : clockOf(at) };
    }
  }
}
