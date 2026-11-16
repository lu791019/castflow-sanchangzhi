/**
 * 日誌時間工具：產品以台北時間（UTC+8，無夏令時）理解「哪一天、什麼時段」。
 * 「邏輯日」以凌晨 4 點為界——半夜一點看完的片仍算前一晚，
 * 讓「隔天中午提醒」「隔天說的」符合夜貓子的直覺。
 */

export const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_START_HOUR = 4;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface TaipeiParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

/** 取台北牆上時間的各欄位 */
export function taipeiParts(date: Date): TaipeiParts {
  const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** 台北某天某時（牆上時間）轉成 UTC Date；day 可溢位，由 Date.UTC 處理進位 */
export function fromTaipei(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - TAIPEI_OFFSET_MS);
}

/** 台北日曆日 YYYY-MM-DD */
export function taipeiDateKey(date: Date): string {
  const { year, month, day } = taipeiParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 邏輯日（4 點換日）的序號：用來算「隔了幾天」 */
export function logicalDayIndex(date: Date): number {
  const shifted = date.getTime() + TAIPEI_OFFSET_MS - DAY_START_HOUR * HOUR_MS;
  return Math.floor(shifted / DAY_MS);
}

/** 邏輯日的台北年月日（凌晨 2 點屬前一天） */
export function logicalDayParts(date: Date): Pick<TaipeiParts, "year" | "month" | "day"> {
  const { year, month, day } = taipeiParts(new Date(date.getTime() - DAY_START_HOUR * HOUR_MS));
  return { year, month, day };
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export const MINUTE_MS = 60 * 1000;
export { HOUR_MS, DAY_MS };
