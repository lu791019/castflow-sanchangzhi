/** 筆名規則（純函式；與 013 profiles_pen_name_shape check 一致：trim 後 1–20 字） */

export const PEN_NAME_MAX_LENGTH = 20;

export type PenNameValidation = { ok: true; value: string } | { ok: false; error: string };

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function validatePenName(raw: unknown): PenNameValidation {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "請取一個筆名" };
  const value = raw.trim();
  if (CONTROL_CHARS.test(value)) return { ok: false, error: "筆名不能有換行或特殊控制字元" };
  // 以 code point 計（與 Postgres char_length 一致）
  if (Array.from(value).length > PEN_NAME_MAX_LENGTH) {
    return { ok: false, error: `筆名最多 ${PEN_NAME_MAX_LENGTH} 個字` };
  }
  return { ok: true, value };
}
