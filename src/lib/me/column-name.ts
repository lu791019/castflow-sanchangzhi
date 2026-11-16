/**
 * 作者專欄名（純函式）：存在 profiles.column_name；null＝沒取，畫面上不顯示那一行（不給預設名）。
 * 規則與 025 profiles_column_name_shape check 一致：去頭尾空白、1–20 字、不含控制字元。
 */

export const COLUMN_NAME_MAX_LENGTH = 20;

export type ColumnNameResult = { ok: true; value: string | null } | { ok: false; error: string };

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const LABEL_PREFIX = /^專欄\s*[｜|]\s*/;

/** 去頭尾空白（含全形）、內部連續空白收成一格、拿掉貼上來的「專欄｜」前綴（畫面會自己加） */
export function normalizeColumnName(raw: string): string {
  return raw.trim().replace(LABEL_PREFIX, "").replace(/[ 　]+/g, " ").trim();
}

export function parseColumnName(value: unknown): ColumnNameResult {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "專欄名格式不對" };
  if (CONTROL_CHARS.test(value)) return { ok: false, error: "專欄名不能有換行或特殊控制字元" };
  const normalized = normalizeColumnName(value);
  if (!normalized) return { ok: true, value: null };
  // 以 code point 計（與 Postgres char_length 一致）
  if (Array.from(normalized).length > COLUMN_NAME_MAX_LENGTH) {
    return { ok: false, error: `專欄名最多 ${COLUMN_NAME_MAX_LENGTH} 個字` };
  }
  return { ok: true, value: normalized };
}

/** 讀出來的值：空的或不合規則都當沒取 */
export function resolveColumnName(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parsed = parseColumnName(stored);
  return parsed.ok ? parsed.value : null;
}

/** 刊頭「專欄｜公車上的散場」；沒取就沒有這一行 */
export function columnLabel(columnName: string | null): string | null {
  return columnName ? `專欄｜${columnName}` : null;
}

/** 作者列副標：「公車上的散場・12篇」；沒取就只留原本的 */
export function withColumnName(columnName: string | null, rest: string): string {
  return columnName ? `${columnName}・${rest}` : rest;
}
