/** 三個端點的輸入驗證（手寫 guard，專案未裝 zod）；系統邊界一律先驗再用 */

import type { WorkKind } from "@/lib/works/format";
import { MIN_QUERY_LENGTH, normalizeQuery } from "./query";
import { PICKER_KINDS, type CreateWorkInput, type PickerKind } from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const WORK_KINDS: readonly WorkKind[] = ["movie", "series", "podcast_episode", "live", "exhibition", "music"];
const ON_SITE_KINDS: readonly WorkKind[] = ["live", "exhibition"];
const MANUAL_TITLE_MAX = 120;
const VENUE_MAX = 80;
const EVENT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function fail<T>(error: string): Parsed<T> {
  return { ok: false, error };
}

function isPickerKind(value: unknown): value is PickerKind {
  return typeof value === "string" && (PICKER_KINDS as readonly string[]).includes(value);
}

function isWorkKind(value: unknown): value is WorkKind {
  return typeof value === "string" && (WORK_KINDS as readonly string[]).includes(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** GET /api/works/search?kind=&q= */
export function parseSearchParams(
  params: URLSearchParams,
): Parsed<{ kind: PickerKind; query: string }> {
  const kind = params.get("kind");
  if (!isPickerKind(kind)) return fail("kind 必須是 movie、series、podcast 或 music");
  const query = normalizeQuery(params.get("q"));
  if (Array.from(query).length < MIN_QUERY_LENGTH) return fail(`至少輸入 ${MIN_QUERY_LENGTH} 個字`);
  return { ok: true, value: { kind, query } };
}

/** GET /api/works/episodes?feed= */
export function parseFeedParam(raw: unknown): Parsed<string> {
  const url = httpUrl(raw);
  return url ? { ok: true, value: url } : fail("feed 必須是 http(s) URL");
}

function parseTmdbInput(body: Record<string, unknown>): Parsed<CreateWorkInput> {
  const { kind, tmdbId } = body;
  if (kind !== "movie" && kind !== "series") return fail("kind 必須是 movie 或 series");
  if (!isPositiveInt(tmdbId)) return fail("tmdbId 必須是正整數");
  return { ok: true, value: { source: "tmdb", kind, tmdbId } };
}

function parseMusicInput(body: Record<string, unknown>): Parsed<CreateWorkInput> {
  if (!isPositiveInt(body.itunesId)) return fail("itunesId 必須是正整數");
  return { ok: true, value: { source: "music", itunesId: body.itunesId } };
}

function parsePodcastInput(body: Record<string, unknown>): Parsed<CreateWorkInput> {
  const feedUrl = httpUrl(body.feedUrl);
  if (!feedUrl) return fail("feedUrl 必須是 http(s) URL");
  const guid = typeof body.guid === "string" ? body.guid.trim() : "";
  if (!guid) return fail("guid 不能為空");
  const itunesId = body.itunesId === undefined || body.itunesId === null ? null : body.itunesId;
  if (itunesId !== null && !isPositiveInt(itunesId)) return fail("itunesId 必須是正整數");
  return { ok: true, value: { source: "podcast", feedUrl, guid, itunesId } };
}

/** YYYY-MM-DD 且是真實日期（擋 2026-02-30）、年份在 works_year_range 內 */
export function isValidEventDate(value: string): boolean {
  const match = EVENT_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1880 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : null;
}

/** 演出／展覽的場地、日期（皆可留空）；其他類型帶了也忽略 */
function parseOnSiteFields(
  kind: WorkKind,
  body: Record<string, unknown>,
): Parsed<{ venue?: string | null; eventDate?: string | null }> {
  if (!ON_SITE_KINDS.includes(kind)) return { ok: true, value: {} };
  const venue = optionalText(body.venue);
  if (venue && Array.from(venue).length > VENUE_MAX) return fail(`場地最多 ${VENUE_MAX} 字`);
  const eventDate = optionalText(body.eventDate);
  if (eventDate && !isValidEventDate(eventDate)) return fail("日期格式須為 YYYY-MM-DD");
  return { ok: true, value: { venue, eventDate } };
}

function parseManualInput(body: Record<string, unknown>): Parsed<CreateWorkInput> {
  const { kind } = body;
  if (!isWorkKind(kind)) return fail("kind 必須是 movie、series、podcast_episode、live、exhibition 或 music");
  const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
  if (!title) return fail("請輸入名稱");
  if (Array.from(title).length > MANUAL_TITLE_MAX) return fail(`名稱最多 ${MANUAL_TITLE_MAX} 字`);
  const onSite = parseOnSiteFields(kind, body);
  if (!onSite.ok) return onSite;
  return { ok: true, value: { source: "manual", kind, title, ...onSite.value } };
}

/** POST /api/works body */
export function parseCreateWorkInput(raw: unknown): Parsed<CreateWorkInput> {
  if (typeof raw !== "object" || raw === null) return fail("請提供 JSON body");
  const body = raw as Record<string, unknown>;
  switch (body.source) {
    case "tmdb":
      return parseTmdbInput(body);
    case "podcast":
      return parsePodcastInput(body);
    case "music":
      return parseMusicInput(body);
    case "manual":
      return parseManualInput(body);
    default:
      return fail("source 必須是 tmdb、podcast、music 或 manual");
  }
}

/**
 * 未登入可建立的作品來源：TMDB / Podcast / 音樂由外部標準資料決定內容且依 tmdb_id、feed+guid、itunes_id 去重；
 * 手動輸入是任意文字，要登入才能建（避免匿名灌入目錄）。
 */
export function allowsAnonymousCreate(input: CreateWorkInput): boolean {
  return input.source !== "manual";
}

