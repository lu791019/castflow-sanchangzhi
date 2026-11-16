/** 回信的字數與輸入規則（P3 Token：letter.limit、letter.grid） */

export const LETTER_LIMIT = 140;
/** 稿紙格：一列 11 格、預設 3 行、最多 13 行 */
export const GRID_COLUMNS = 11;
export const GRID_MIN_ROWS = 3;
export const GRID_MAX_ROWS = 13;

// 換行（\n）以外的控制字元
const CONTROL_CHARS = /[\u0000-\u0009\u000b-\u001f\u007f]/;

export type TextCheck = { ok: true; value: string } | { ok: false; error: string };

/** 以字元（code point）計，與 DB char_length 一致 */
export function countChars(text: string): number {
  return Array.from(text).length;
}

export function overLimitMessage(chars: number): string {
  return `多了 ${chars - LETTER_LIMIT} 個字，刪掉一些再寄。`;
}

/** 信與作者回覆共用：去頭尾空白後 1–140 字、不含控制字元 */
export function validateLetterText(raw: unknown): TextCheck {
  if (typeof raw !== "string") return { ok: false, error: "寫點什麼再寄。" };
  const value = raw.trim();
  if (!value) return { ok: false, error: "寫點什麼再寄。" };
  if (CONTROL_CHARS.test(value)) return { ok: false, error: "信裡有無法顯示的字元。" };
  const chars = countChars(value);
  if (chars > LETTER_LIMIT) return { ok: false, error: overLimitMessage(chars) };
  return { ok: true, value };
}

export function gridRows(chars: number): number {
  return Math.min(GRID_MAX_ROWS, Math.max(GRID_MIN_ROWS, Math.ceil(chars / GRID_COLUMNS)));
}
