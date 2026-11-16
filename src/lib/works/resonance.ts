/**
 * 「大家最有共鳴的一句」排版規則（設計稿 A/B/C/E 四態）
 * - A：≥3 句可直排 → 直排三句（第一句明體 23）
 * - B：2 句可直排 → 直排兩句，靠右留白
 * - C：只有 1 句，或句子超過 22 字 → 橫排 pull quote +「等第二句」
 * - E：零句 → 空白稿紙
 * 選句：每篇一句（來源 = 該篇 pull quote）；同一位作者最多入選一句；
 * 排序依發表時間（早 → 晚，第一個說話的人佔第一行）。
 * TODO(resonance): 共鳴數欄位上線後，排序改依共鳴數（同數再依發表時間）。
 */

export const RESONANCE_MAX_CHARS = 22;
export const RESONANCE_MAX_QUOTES = 3;

export interface ResonanceCandidate {
  quote: string;
  author: string;
  publishedAt: string;
}

export interface ResonanceQuote {
  quote: string;
  author: string;
}

export type ResonanceLayout =
  | { variant: "A" | "B"; quotes: ResonanceQuote[] }
  | { variant: "C"; quote: ResonanceQuote }
  | { variant: "E" };

/** 去掉外層引號與空白，作為顯示與計字基準（引號由元件補上） */
export function normalizeQuote(raw: string): string {
  return raw
    .trim()
    .replace(/^[「『"“]+/, "")
    .replace(/[」』"”]+$/, "")
    .trim();
}

export function quoteLength(quote: string): number {
  return Array.from(normalizeQuote(quote)).length;
}

export function fitsVertical(quote: string): boolean {
  return quoteLength(quote) <= RESONANCE_MAX_CHARS;
}

/** 依發表時間排序 + 同作者去重（保留最早一句） */
export function selectResonanceQuotes(
  candidates: ResonanceCandidate[],
): ResonanceQuote[] {
  const sorted = [...candidates]
    .filter((candidate) => normalizeQuote(candidate.quote).length > 0)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const seenAuthors = new Set<string>();
  return sorted.flatMap((candidate) => {
    const authorKey = candidate.author.trim();
    if (seenAuthors.has(authorKey)) return [];
    seenAuthors.add(authorKey);
    return [{ quote: normalizeQuote(candidate.quote), author: authorKey }];
  });
}

export function layoutResonance(quotes: ResonanceQuote[]): ResonanceLayout {
  if (quotes.length === 0) return { variant: "E" };
  const vertical = quotes.filter((item) => fitsVertical(item.quote));
  if (vertical.length >= RESONANCE_MAX_QUOTES) {
    return { variant: "A", quotes: vertical.slice(0, RESONANCE_MAX_QUOTES) };
  }
  // 兩句可直排（含第三句超長被排除的情況）
  if (vertical.length === 2) return { variant: "B", quotes: vertical };
  return { variant: "C", quote: quotes[0] };
}
