/**
 * 全站數字寫法（10/11 Dex 拍板，取代 Token number.style 的國字）：
 * 由資料算出來的數值一律阿拉伯數字，與中文之間加半形空格（「2 篇」「10 月 9 日」）。
 * 直排時 1–2 位數字併成一格（text-combine-upright），3 位以上逐字直立。
 */

const COMBINE_MAX = 2;

/** 數量：非負整數字串 */
export function countText(value: number): string {
  const n = Math.floor(value);
  return Number.isFinite(n) && n > 0 ? String(n) : "0";
}

/** 月日：10 月 9 日（不補零） */
export function monthDayText(month: number, day: number): string {
  return `${month} 月 ${day} 日`;
}

export type VerticalRunKind = "text" | "combine" | "upright";

export interface VerticalDigitRun {
  text: string;
  kind: VerticalRunKind;
}

/** 直排切段：數字段單獨成段（數字兩側的半形空格在直排裡會變成空格，拿掉） */
export function verticalDigitRuns(text: string): VerticalDigitRun[] {
  return text
    .split(/ *(\d+) */)
    .flatMap((part, index): VerticalDigitRun[] => {
      if (!part) return [];
      if (index % 2 === 0) return [{ text: part, kind: "text" }];
      return [{ text: part, kind: part.length <= COMBINE_MAX ? "combine" : "upright" }];
    });
}

const CJK = "\\u3400-\\u9fff\\uf900-\\ufaff";
const CJK_THEN_DIGIT = new RegExp(`([${CJK}])(\\d)`, "g");
const DIGIT_THEN_CJK = new RegExp(`(\\d)([${CJK}])`, "g");

/** 中文與數字之間補半形空格（拼接口語片段後統一處理） */
export function cjkSpacing(text: string): string {
  return text.replace(CJK_THEN_DIGIT, "$1 $2").replace(DIGIT_THEN_CJK, "$1 $2");
}
