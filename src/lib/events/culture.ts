/**
 * 文化部藝文活動開放資料（純函式）：解析 → 對應演出／展覽 → 只留今天起 30 天內有場次的 → 去重 → 排序 → 每類上限。
 * 來源 https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=<n>（免金鑰），
 * 欄位 UID、title、showInfo[{time,endTime,location,locationName}]、startDate、endDate、imageUrl、webSales、sourceWebPromote。
 * 政府資料開放授權要求標示來源：畫面上寫 CULTURE_ATTRIBUTION。
 */

import { MAX_LIVE_NAME_LENGTH, MAX_LIVE_VENUE_LENGTH } from "@/lib/venue/input";
import { liveKey } from "@/lib/venue/name";
import { cityFromAddress, titleCategory, type EventCategory } from "./collected";

export const CULTURE_ATTRIBUTION = "資料來源：文化部文化資料開放服務網";
export const CULTURE_SOURCE_URL = "https://cloud.culture.tw/";

export type CultureKind = "live" | "exhibition";

/** 細類：events 表的六類＋文化部才有的「獨立音樂」（類別 5；不進 DB，events.category 不用改） */
export type CultureCategory = EventCategory | "indie";

/** 1 音樂、2 戲劇、3 舞蹈、5 獨立音樂、17 演唱會 → 演出；6 展覽 → 展覽 */
export const CULTURE_CATEGORIES: Record<CultureKind, readonly string[]> = {
  live: ["1", "2", "3", "5", "17"],
  exhibition: ["6"],
};

export const CULTURE_WINDOW_DAYS = 30;
/** 演出的單一場次跨超過這麼多天＝常態節目（街頭藝人、整年駐演），不是「一場」，不收 */
export const MAX_LIVE_SESSION_DAYS = 31;
export const CULTURE_LIMITS: Record<CultureKind, number> = { live: 12, exhibition: 8 };

export interface CultureSession {
  /** YYYY-MM-DD */
  start: string;
  /** 跨日才有（YYYY-MM-DD） */
  end: string | null;
  /** HH:MM；來源寫 00:00 視為沒寫 */
  time: string | null;
  venue: string | null;
  /** 縣市（一律「臺」）；文化部從地址推、多來源用 events.city；看不出來 null（選了縣市時不出現） */
  city?: string | null;
}

export interface CultureEvent {
  uid: string;
  kind: CultureKind;
  /** 標題含音樂祭／音樂節／Fest：仍是演出，卡片寫「音樂祭」 */
  festival: boolean;
  /** 細類（演唱會、獨立音樂、戲劇、舞蹈、音樂祭、一般演出、展覽）；沒有時由標題推（subcategory.ts） */
  category?: CultureCategory;
  title: string;
  imageUrl: string | null;
  /** 售票頁優先（ticket），沒有就用活動頁 */
  link: { url: string; ticket: boolean } | null;
  sessions: CultureSession[];
}

/** 選中的那一場：30 天內第一個還沒結束的場次 */
export interface SelectedCultureEvent extends CultureEvent {
  session: CultureSession;
}

type Raw = Record<string, unknown>;

const FESTIVAL = /音樂祭|音樂節|fest/i;
/** 加購／升級票券不是活動本身 */
const NOT_AN_EVENT = /加購/;
const DATE_TIME = /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/;
const DAY_MS = 86_400_000;

export function cultureKindOf(category: string): CultureKind | null {
  if (CULTURE_CATEGORIES.live.includes(category)) return "live";
  if (CULTURE_CATEGORIES.exhibition.includes(category)) return "exhibition";
  return null;
}

export function isFestivalTitle(title: string): boolean {
  return FESTIVAL.test(title);
}

/** 文化部類別代碼能直接對到的細類：2 戲劇、3 舞蹈、5 獨立音樂、17 演唱會（1 音樂看標題） */
const CODE_CATEGORY: Readonly<Record<string, CultureCategory>> = { "2": "theatre", "3": "dance", "5": "indie", "17": "concert" };

/** 文化部活動的細類：音樂祭標題 → 類別代碼 → 標題（collected.ts 同一套）→ 一般演出 */
export function cultureCategoryOf(title: string, kind: CultureKind, code: string): CultureCategory {
  if (kind === "exhibition") return "exhibition";
  if (isFestivalTitle(title)) return "festival";
  const byCode = CODE_CATEGORY[code];
  if (byCode) return byCode;
  // 標題像展覽、影展的演出不改類，算一般演出
  const byTitle = titleCategory(title);
  return byTitle === "concert" || byTitle === "theatre" || byTitle === "dance" ? byTitle : "performance";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** 「2026/10/20 19:30:00」→ 日期與時間；不是真實日期回 null */
function parseDateTime(value: unknown): { day: string; time: string | null } | null {
  const match = DATE_TIME.exec(text(value));
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  const hour = match[4] === undefined ? null : Number(match[4]);
  const minute = match[5] === undefined ? null : Number(match[5]);
  const time = hour === null || minute === null || (hour === 0 && minute === 0) ? null : `${pad2(hour)}:${pad2(minute)}`;
  return { day: `${year}-${pad2(month)}-${pad2(day)}`, time };
}

function httpsUrl(value: unknown): string | null {
  const trimmed = text(value);
  if (!/^https?:\/\//i.test(trimmed) || !URL.canParse(trimmed)) return null;
  return trimmed.replace(/^http:\/\//i, "https://");
}

function linkOf(raw: Raw): CultureEvent["link"] {
  const ticket = httpsUrl(raw.webSales);
  if (ticket) return { url: ticket, ticket: true };
  const info = httpsUrl(raw.sourceWebPromote);
  return info ? { url: info, ticket: false } : null;
}

function venueOf(row: Raw): string | null {
  // 來源偶有尾巴的「=」（例：花蓮市（花蓮縣）=）
  const venue = (text(row.locationName) || text(row.location)).replace(/[=\s]+$/u, "");
  return venue ? Array.from(venue).slice(0, MAX_LIVE_VENUE_LENGTH).join("") : null;
}

/** 地址推縣市，地址看不出來再看場地名 */
function cityOf(row: Raw): string | null {
  return cityFromAddress(text(row.location)) ?? cityFromAddress(text(row.locationName));
}

function session(startValue: unknown, endValue: unknown, venue: string | null, city: string | null): CultureSession | null {
  const start = parseDateTime(startValue);
  if (!start) return null;
  const end = parseDateTime(endValue);
  return { start: start.day, end: end && end.day > start.day ? end.day : null, time: start.time, venue, city };
}

function sessionsOf(row: Raw): CultureSession[] {
  const shows = Array.isArray(row.showInfo) ? (row.showInfo as unknown[]) : [];
  const parsed = shows.flatMap((show) => {
    if (!show || typeof show !== "object") return [];
    const item = show as Raw;
    const one = session(item.time, item.endTime, venueOf(item), cityOf(item));
    return one ? [one] : [];
  });
  if (parsed.length > 0) return parsed;
  const fallback = session(row.startDate, row.endDate, null, null);
  return fallback ? [fallback] : [];
}

function parseRow(row: unknown, kind: CultureKind, code: string): CultureEvent | null {
  if (!row || typeof row !== "object") return null;
  const raw = row as Raw;
  const uid = text(raw.UID);
  const title = text(raw.title);
  if (!uid || !title || Array.from(title).length > MAX_LIVE_NAME_LENGTH || NOT_AN_EVENT.test(title)) return null;
  const sessions = sessionsOf(raw);
  if (sessions.length === 0) return null;
  return {
    uid,
    kind,
    festival: kind === "live" && isFestivalTitle(title),
    category: cultureCategoryOf(title, kind, code),
    title,
    imageUrl: httpsUrl(raw.imageUrl),
    link: linkOf(raw),
    sessions,
  };
}

/** 一個類別的回應 → 活動；壞資料跳過，不認得的類別回空 */
export function parseCultureEvents(data: unknown, category: string): CultureEvent[] {
  const kind = cultureKindOf(category);
  if (!kind || !Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = parseRow(row, kind, category);
    return parsed ? [parsed] : [];
  });
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function spanDays(item: CultureSession): number {
  return item.end ? Math.round((Date.parse(`${item.end}T00:00:00Z`) - Date.parse(`${item.start}T00:00:00Z`)) / DAY_MS) : 0;
}

/** 場次和 [今天, 今天＋30] 有交集的（演出跳過常態節目） */
export function sessionsInWindow(event: CultureEvent, today: string): CultureSession[] {
  const to = addDays(today, CULTURE_WINDOW_DAYS);
  return event.sessions.filter(
    (item) =>
      item.start <= to &&
      (item.end ?? item.start) >= today &&
      (event.kind === "exhibition" || spanDays(item) <= MAX_LIVE_SESSION_DAYS),
  );
}

/** 窗內第一場（照開始日） */
function firstSessionInWindow(event: CultureEvent, today: string): CultureSession | null {
  const hits = sessionsInWindow(event, today);
  if (hits.length === 0) return null;
  return hits.reduce((first, next) => (next.start < first.start ? next : first));
}

function dedupeKey(event: SelectedCultureEvent): string {
  return `${event.kind}:${liveKey(event.title) ?? event.uid}:${event.session.start}`;
}

/** 依序去重：同 UID、或同類同名同開始日（不同 UID 的重複上架）只留第一筆 */
function dedupe<T extends SelectedCultureEvent>(events: readonly T[]): T[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const keys = [`uid:${event.uid}`, dedupeKey(event)];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

/** 近的在前：開始日（進行中算今天）→ 展覽先結束的在前／演出看時間 */
function compareEvents(today: string) {
  const sortDay = (event: SelectedCultureEvent) => (event.session.start > today ? event.session.start : today);
  const tieBreak = (event: SelectedCultureEvent) =>
    event.kind === "exhibition" ? (event.session.end ?? event.session.start) : (event.session.time ?? "24:00");
  return (a: SelectedCultureEvent, b: SelectedCultureEvent) =>
    sortDay(a).localeCompare(sortDay(b)) || tieBreak(a).localeCompare(tieBreak(b));
}

/** 30 天窗內有場次的（每筆選一場）→ 去重 → 近的在前；不設上限（多來源合併時另外取上限） */
export function selectInWindow<T extends CultureEvent>(events: readonly T[], today: string): Array<T & { session: CultureSession }> {
  const inWindow = events.flatMap((event) => {
    const chosen = firstSessionInWindow(event, today);
    return chosen ? [{ ...event, session: chosen }] : [];
  });
  return dedupe(inWindow).sort(compareEvents(today));
}

/** 近的在前（進行中算今天）：給合併後重新排序用 */
export function compareSelectedEvents(today: string): (a: SelectedCultureEvent, b: SelectedCultureEvent) => number {
  return compareEvents(today);
}

export function selectCultureEvents(
  events: readonly CultureEvent[],
  today: string,
): Record<CultureKind, SelectedCultureEvent[]> {
  const sorted = selectInWindow(events, today);
  return {
    live: sorted.filter((event) => event.kind === "live").slice(0, CULTURE_LIMITS.live),
    exhibition: sorted.filter((event) => event.kind === "exhibition").slice(0, CULTURE_LIMITS.exhibition),
  };
}
