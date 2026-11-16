/**
 * 場外日期（純函式）：記一筆「日期」欄是手寫文字（例：10.09 – 10.10、2026.09.12 – 11.30）。
 * 回傳 YYYY-MM-DD；單日 end 為 null。缺年份時用記錄那天的年份，離記錄日超過半年往前推一年；
 * 迄日沒寫年份且早於起日視為跨年。看不懂就回錯誤，不猜。
 */

export interface LiveDateRange {
  start: string;
  end: string | null;
}

export type LiveDatesResult = { ok: true; value: LiveDateRange | null } | { ok: false; error: string };

export const LIVE_DATES_HINT = "日期看不懂，寫成 10.09 或 10.09 – 10.10";
const MAX_TEXT_LENGTH = 60;
const MAX_SPAN_DAYS = 366;
const HALF_YEAR_DAYS = 183;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_TOKEN = /(?:(\d{4})\s*[./\-年]\s*)?(\d{1,2})\s*[./\-月]\s*(\d{1,2})\s*日?/g;

interface Token {
  year: number | null;
  month: number;
  day: number;
}

function toUtc(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? time : null;
}

function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function tokensOf(text: string): Token[] {
  return Array.from(text.matchAll(DATE_TOKEN), (match) => ({
    year: match[1] ? Number(match[1]) : null,
    month: Number(match[2]),
    day: Number(match[3]),
  }));
}

/** 缺年份的起日：用記錄日年份；比記錄日晚半年以上 → 去年 */
function resolveStart(token: Token, refTime: number, refYear: number): number | null {
  if (token.year !== null) return toUtc(token.year, token.month, token.day);
  const guess = toUtc(refYear, token.month, token.day);
  if (guess === null) return null;
  return guess - refTime > HALF_YEAR_DAYS * DAY_MS ? toUtc(refYear - 1, token.month, token.day) : guess;
}

function resolveEnd(token: Token, startTime: number): number | null {
  if (token.year !== null) return toUtc(token.year, token.month, token.day);
  const startYear = new Date(startTime).getUTCFullYear();
  const sameYear = toUtc(startYear, token.month, token.day);
  if (sameYear === null) return null;
  return sameYear < startTime ? toUtc(startYear + 1, token.month, token.day) : sameYear;
}

/** refDate：YYYY-MM-DD（記一筆那天，台北邏輯日） */
export function parseLiveDates(text: string, refDate: string): LiveDatesResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > MAX_TEXT_LENGTH) return { ok: false, error: LIVE_DATES_HINT };
  const refTime = Date.parse(`${refDate}T00:00:00Z`);
  if (Number.isNaN(refTime)) return { ok: false, error: LIVE_DATES_HINT };

  const tokens = tokensOf(trimmed);
  if (tokens.length === 0 || tokens.length > 2) return { ok: false, error: LIVE_DATES_HINT };
  const start = resolveStart(tokens[0], refTime, new Date(refTime).getUTCFullYear());
  if (start === null) return { ok: false, error: LIVE_DATES_HINT };
  if (tokens.length === 1) return { ok: true, value: { start: iso(start), end: null } };

  const end = resolveEnd(tokens[1], start);
  if (end === null) return { ok: false, error: LIVE_DATES_HINT };
  if (end < start) return { ok: false, error: "結束日期比開始日期早" };
  if (end - start > MAX_SPAN_DAYS * DAY_MS) return { ok: false, error: "日期區間太長，最多一年" };
  return { ok: true, value: { start: iso(start), end: end === start ? null : iso(end) } };
}
