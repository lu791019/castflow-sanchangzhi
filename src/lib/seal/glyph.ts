/**
 * 印文用字（純函式）：作者可在設定裡換印文用字，限筆名中的字；外形不能自選（設計稿「P3 元件特寫 01」）。
 * 存在 profiles.seal_glyph；null＝依規則（seal.ts sealGlyph）。
 */

const NOT_GLYPH = /[\p{P}\p{S}\p{Z}\s\p{C}]/u;
export const SEAL_GLYPH_ERROR = "印文只能用筆名裡的一個字";

export type GlyphResult = { ok: true; value: string | null } | { ok: false; error: string };

/** 筆名中可當印文的字：逐字去重保序，略過空白、標點、符號 */
export function glyphChoices(penName: string): string[] {
  const chars = Array.from(penName.trim()).filter((char) => !NOT_GLYPH.test(char));
  return [...new Set(chars)];
}

export function parseSealGlyph(value: unknown, penName: string): GlyphResult {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || Array.from(value).length !== 1) return { ok: false, error: SEAL_GLYPH_ERROR };
  return glyphChoices(penName).includes(value) ? { ok: true, value } : { ok: false, error: SEAL_GLYPH_ERROR };
}

/** 讀出來的字已不在筆名裡（改過筆名）→ null，交回規則 */
export function resolveGlyph(stored: string | null | undefined, penName: string): string | null {
  return stored && glyphChoices(penName).includes(stored) ? stored : null;
}
