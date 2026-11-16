/**
 * 館方展覽來源共用（純函式）：西元／民國日期、起訖區間、常設展判斷、標題清理、相對網址、館內位置 vs 館外場地。
 * 館方列表只取事實欄位（標題、起訖、場地、圖、官網頁），不存展覽介紹。
 */

import { cityFromAddress, type CollectedEvent, type EventCategory, type EventSource } from "../../../src/lib/events/collected.ts";
import { buildEvent } from "../build.ts";
import { cleanText, decodeEntities } from "../html.ts";

/** 起訖跨度超過這麼多天視為常設展，不收 */
export const MAX_EXHIBITION_SPAN_DAYS = 400;

const DAY_MS = 86_400_000;
const ROC_OFFSET = 1911;
const PERMANENT = /常設展/;
const pad2 = (value: number) => String(value).padStart(2, "0");

/** 年月日 → YYYY-MM-DD；不是真實日期回 null */
export function ymd(year: number, month: number, day: number): string | null {
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 西元日期：「2026/10/15」「2026-10-15」「2026.10.15」「2026-10-15T00:00:00+00:00」→ YYYY-MM-DD（取第一個） */
export function westernDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/.exec(value);
  return match ? ymd(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

/** 民國日期：「1150618」「115-06-30」「115/6/30」→ 西元 YYYY-MM-DD */
export function rocDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = /^(\d{2,3})(\d{2})(\d{2})$/.exec(text) ?? /^(\d{2,3})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})$/.exec(text);
  return match ? ymd(Number(match[1]) + ROC_OFFSET, Number(match[2]), Number(match[3])) : null;
}

/** 西元或民國都試（開放資料常混用）；空白回 null */
export function anyDate(value: unknown): string | null {
  return rocDate(value) ?? westernDate(value);
}

/** 「起 ~ 訖」（~、～、至）：各自解析；沒有訖（「不定期結束」、只寫一天）end 為 null */
export function dateRange(value: unknown, parse: (part: string) => string | null): { start: string | null; end: string | null } {
  const text = cleanText(value);
  const [first = "", second = ""] = text.split(/\s*[~～至]\s*/);
  return { start: parse(first), end: second ? parse(second) : null };
}

export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

/** 開始日早於今天超過常設上限：這筆（以及排在它前面的）一定不收 */
export function startedTooLongAgo(startsOn: string | null, today: string): boolean {
  return !startsOn || daysBetween(startsOn, today) > MAX_EXHIBITION_SPAN_DAYS;
}

/** 前面的【展覽預告】、分類字「特展 」、後面的（免費參觀）拿掉；中英並列只留中文（常設展字樣留著，給 venueEvent 擋） */
export function venueTitle(raw: unknown): string {
  const text = cleanText(raw);
  const noTag = text.replace(/^(?:【[^】]*】\s*)+/, "").replace(/^(?:特展|微型展)\s+/, "") || text;
  const noFree = noTag.replace(/\s*[(（]免費(?:參觀|入場)[)）]\s*$/, "");
  const [chinese] = noFree.split(/\s+[╱／/]\s+/);
  const trimmed = chinese.replace(/^(.*\p{Script=Han}[^A-Za-z]*?)\s+[A-Za-z][\x20-\x7E’]*$/u, "$1").trim();
  return trimmed || noFree;
}

/** 相對網址 → https 絕對網址（非 ASCII 會編碼）；同站的 http 升成 https，其他不是 https 的回 null */
export function absoluteUrl(path: unknown, base: string): string | null {
  const text = typeof path === "string" ? decodeEntities(path.trim()) : "";
  if (!text) return null;
  try {
    const url = new URL(text, base);
    if (url.protocol === "http:" && url.host === new URL(base).host) url.protocol = "https:";
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export interface VenueHome {
  /** 本館名稱（當場地） */
  name: string;
  /** 館內位置會出現的字（展廳、本館別名）；比對到就算本館 */
  pattern: RegExp;
}

/** 館內位置（「2展廳」「國立歷史博物館5樓」）用本館名稱；看得出是別的館（「佛光山佛陀紀念館第二展廳」）就用位置當場地 */
export function venueOf(home: VenueHome, location: unknown): string {
  const text = cleanText(location);
  if (!text || home.pattern.test(text) || !/館|中心|園區|基金會|美術|博物/.test(text)) return home.name;
  return text;
}

export function cityOfVenue(venue: string, home: VenueHome, homeCity: string): string | null {
  return venue === home.name ? homeCity : cityFromAddress(venue);
}

export interface ExhibitionDraft {
  source: EventSource;
  sourceId: string;
  title: string;
  venue: string;
  city: string | null;
  startsOn: string | null;
  endsOn: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  /** 預設展覽；C-LAB 的演出給 performance（再照標題推細類） */
  category?: EventCategory;
}

/**
 * 館方列表一筆 → CollectedEvent：沒有開始或結束日、起訖顛倒、跨度超過 MAX_EXHIBITION_SPAN_DAYS、標題寫常設展、
 * 雜訊標題（工作坊、導覽、博覽會…）都不收。展覽一律算展覽（標題沒有「展」字也是），同北美館。
 */
export function venueEvent(draft: ExhibitionDraft): CollectedEvent | null {
  const { startsOn, endsOn } = draft;
  if (!startsOn || !endsOn || endsOn < startsOn) return null;
  if (daysBetween(startsOn, endsOn) > MAX_EXHIBITION_SPAN_DAYS || PERMANENT.test(draft.title)) return null;
  const category = draft.category ?? "exhibition";
  const event = buildEvent({
    source: draft.source,
    sourceId: draft.sourceId,
    title: draft.title,
    fallbackCategory: category,
    venue: draft.venue,
    city: draft.city,
    startsOn,
    endsOn,
    showTimes: [],
    ticketUrls: [],
    imageUrl: draft.imageUrl,
    sourceUrl: draft.sourceUrl,
  });
  if (!event) return null;
  return category === "exhibition" ? { ...event, category: "exhibition" } : event;
}

/** 已結束的不收（台北日期） */
export function notEndedBy(today: string) {
  return (event: CollectedEvent) => event.endsOn >= today;
}

/** 同來源同一筆只留一次（列表常重複出現同一檔，例如輪播＋列表） */
export function uniqueBySourceId(events: readonly CollectedEvent[]): CollectedEvent[] {
  return [...new Map(events.map((event) => [event.sourceId, event])).values()];
}
