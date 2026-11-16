/** 閱讀頁「引用到我的感受」帶來的 ?quote= 參數：清理後預填到「用打的」 */

export const MAX_QUOTE_CHARS = 200;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WRAPPING_QUOTES: ReadonlyArray<readonly [string, string]> = [
  ["「", "」"],
  ["『", "』"],
  ['"', '"'],
  ["“", "”"],
];

function stripWrappingQuotes(text: string): string {
  const pair = WRAPPING_QUOTES.find(([open, close]) => text.startsWith(open) && text.endsWith(close));
  if (!pair || text.length < 2) return text;
  return text.slice(pair[0].length, text.length - pair[1].length).trim();
}

function truncate(text: string): string {
  const chars = Array.from(text);
  return chars.length > MAX_QUOTE_CHARS ? `${chars.slice(0, MAX_QUOTE_CHARS).join("")}…` : text;
}

export function normalizeQuoteParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const cleaned = stripWrappingQuotes(value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim());
  return cleaned ? truncate(cleaned) : null;
}

export function quotePrefillText(quote: string): string {
  return `「${quote}」\n\n`;
}
