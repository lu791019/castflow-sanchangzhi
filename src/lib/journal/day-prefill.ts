/** 日誌月曆點日期格記一筆：該日要預填到記一筆 sheet 的「什麼時候」（純函式） */

/** 點某一天＝那天晚上看的、聽的、逛的；sheet 裡可以再改 */
export const DAY_PREFILL_TIME = "20:00";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DayPrefill {
  when: "custom";
  /** datetime-local 值（台北牆上時間） */
  custom: string;
}

/**
 * 過去與未來的日子：切到「選日期時間」並預填當天 20:00（未來格送出時自動變排進行程）。
 * 今天不預填，維持「剛剛」——否則下午點今天會被當成晚上的計畫。
 */
export function dayPrefill(dateKey: string, todayKey: string): DayPrefill | undefined {
  if (!DATE_KEY_PATTERN.test(dateKey) || dateKey === todayKey) return undefined;
  return { when: "custom", custom: `${dateKey}T${DAY_PREFILL_TIME}` };
}
