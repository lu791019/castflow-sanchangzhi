/**
 * 「說了什麼」的有效字數：轉錄只出「.」或幾個語助詞時，送去整理只會得到拒絕訊息（UX-02）。
 * 只算文字與數字（含漢字），標點、空白、符號不算。
 */

export const MIN_MEANINGFUL_CHARS = 10;

const MEANINGFUL_PATTERN = /[\p{L}\p{N}]/gu;

export function countMeaningfulChars(text: string | null | undefined): number {
  return text?.match(MEANINGFUL_PATTERN)?.length ?? 0;
}

export function isTooShortToGenerate(text: string | null | undefined): boolean {
  return countMeaningfulChars(text) < MIN_MEANINGFUL_CHARS;
}
