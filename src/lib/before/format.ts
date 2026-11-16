/** 散場之前卡片共用的日期寫法（純函式） */

/** 場外只有日期沒有時間時，預填的開演時間（可在 sheet 裡改） */
export const LIVE_DEFAULT_TIME = "19:30";

/** YYYY-MM-DD → MM.DD */
export function shortDate(day: string): string {
  return `${day.slice(5, 7)}.${day.slice(8, 10)}`;
}

/** YYYY-MM-DD → YYYY.MM.DD（記一筆場外「日期」欄看得懂的寫法） */
export function fullDate(day: string): string {
  return day.replaceAll("-", ".");
}
