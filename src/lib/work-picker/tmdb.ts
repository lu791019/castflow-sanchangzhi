/**
 * TMDB 封裝（只在 server 呼叫，key 絕不下發瀏覽器）。
 * 搜尋端點拿不到導演，列表只顯示「年份・原文片名」；點選後再打一次詳情補導演（data-feasibility.md 第二節）。
 */

import type { ScreenResult } from "./types";
import { externalOverridesAllowed } from "../e2e-overrides.ts";

const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const TMDB_TIMEOUT_MS = 8_000;
const SEARCH_RESULT_MAX = 20;

export interface TmdbDeps {
  fetch: typeof fetch;
  /** v4 Read Access Token（Bearer）；與 apiKey 擇一 */
  readAccessToken: string | null;
  /** v3 key（query param） */
  apiKey: string | null;
  /** 只給本機 E2E 指到假 TMDB（env TMDB_API_BASE，正式環境不吃）；預設官方 */
  baseUrl?: string;
}

export interface TmdbDetail {
  kind: "movie" | "series";
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  region: string | null;
  posterUrl: string | null;
  credit: string | null;
  /** 電影片長（分）；估散場時間用（migration 032），沒有就不帶 */
  runtimeMinutes?: number;
}

/** 片長只收 1–1000 分的整數，其餘視為沒有 */
function runtimeOf(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 1000 ? value : null;
}

export class TmdbError extends Error {
  // 不用 parameter property：worker 以 Node strip-types 直接 import 本檔，不支援該語法
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

type Raw = Record<string, unknown>;

const REGION_NAMES: Record<string, string> = {
  TW: "台灣",
  JP: "日本",
  KR: "韓國",
  US: "美國",
  GB: "英國",
  CN: "中國",
  HK: "香港",
  FR: "法國",
  DE: "德國",
  IT: "義大利",
  ES: "西班牙",
  IN: "印度",
  TH: "泰國",
  CA: "加拿大",
  AU: "澳洲",
  NZ: "紐西蘭",
  IE: "愛爾蘭",
  DK: "丹麥",
  SE: "瑞典",
  NO: "挪威",
  FI: "芬蘭",
  NL: "荷蘭",
  BE: "比利時",
  PL: "波蘭",
  RU: "俄羅斯",
  BR: "巴西",
  MX: "墨西哥",
  AR: "阿根廷",
  IR: "伊朗",
  TR: "土耳其",
  SG: "新加坡",
  MY: "馬來西亞",
  PH: "菲律賓",
  ID: "印尼",
  VN: "越南",
};

/** YYYY-MM-DD 原樣保留；其他形狀回 null */
export function dateOrNull(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function yearOf(date: unknown): number | null {
  if (typeof date !== "string" || !/^\d{4}/.test(date)) return null;
  return Number(date.slice(0, 4));
}

export function tmdbPosterUrl(path: unknown): string | null {
  return typeof path === "string" && path ? `${POSTER_BASE}${path}` : null;
}

/** 第一個國碼轉中文；未收錄保留原碼 */
export function regionLabel(codes: unknown): string | null {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  const first = codes[0];
  if (typeof first !== "string" || !first) return null;
  return REGION_NAMES[first] ?? first;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function originalOrNull(title: string, original: unknown): string | null {
  const value = text(original);
  return value && value !== title ? value : null;
}

export function normalizeMovie(raw: Raw): ScreenResult | null {
  const title = text(raw.title);
  if (typeof raw.id !== "number" || !title) return null;
  return {
    kind: "movie",
    tmdbId: raw.id,
    title,
    originalTitle: originalOrNull(title, raw.original_title),
    year: yearOf(raw.release_date),
    region: null,
    posterUrl: tmdbPosterUrl(raw.poster_path),
    releaseDate: dateOrNull(raw.release_date),
    feelingCount: 0,
  };
}

export function normalizeTv(raw: Raw): ScreenResult | null {
  const title = text(raw.name);
  if (typeof raw.id !== "number" || !title) return null;
  return {
    kind: "series",
    tmdbId: raw.id,
    title,
    originalTitle: originalOrNull(title, raw.original_name),
    year: yearOf(raw.first_air_date),
    region: regionLabel(raw.origin_country),
    posterUrl: tmdbPosterUrl(raw.poster_path),
    releaseDate: dateOrNull(raw.first_air_date),
    feelingCount: 0,
  };
}

function joinNames(people: unknown[]): string | null {
  const names = people
    .map((person) => (typeof person === "object" && person ? text((person as Raw).name) : null))
    .filter((name): name is string => name !== null);
  return names.length > 0 ? names.join("、") : null;
}

/** credits.crew 裡 job=Director */
export function extractDirector(credits: unknown): string | null {
  if (typeof credits !== "object" || credits === null) return null;
  const crew = (credits as Raw).crew;
  if (!Array.isArray(crew)) return null;
  return joinNames(crew.filter((member) => (member as Raw)?.job === "Director"));
}

/** 影集 created_by */
export function extractCreators(createdBy: unknown): string | null {
  return Array.isArray(createdBy) ? joinNames(createdBy) : null;
}

function buildUrl(path: string, params: Record<string, string>, deps: TmdbDeps): string {
  const url = new URL(`${deps.baseUrl ?? TMDB_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  if (!deps.readAccessToken && deps.apiKey) url.searchParams.set("api_key", deps.apiKey);
  return url.toString();
}

/** 低階 GET（watch providers 等其他端點共用）；回傳原始 JSON */
export async function tmdbGet(path: string, params: Record<string, string>, deps: TmdbDeps): Promise<Raw> {
  if (!deps.readAccessToken && !deps.apiKey) {
    throw new TmdbError("TMDB_API_KEY 或 TMDB_READ_ACCESS_TOKEN 未設定", null);
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (deps.readAccessToken) headers.Authorization = `Bearer ${deps.readAccessToken}`;
  let response: Response;
  try {
    response = await deps.fetch(buildUrl(path, { language: "zh-TW", ...params }, deps), {
      headers,
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new TmdbError(error instanceof Error ? error.message : "TMDB 連線失敗", null);
  }
  if (!response.ok) throw new TmdbError(`TMDB 回應 ${response.status}`, response.status);
  return (await response.json()) as Raw;
}

/** search/movie 或 search/tv，zh-TW、排除成人內容，最多 20 筆；year 可選（movie=year、tv=first_air_date_year） */
export async function searchTmdb(
  kind: "movie" | "series",
  query: string,
  deps: TmdbDeps,
  options: { year?: number | null } = {},
): Promise<ScreenResult[]> {
  const path = kind === "movie" ? "/search/movie" : "/search/tv";
  const yearParam: Record<string, string> = options.year
    ? { [kind === "movie" ? "year" : "first_air_date_year"]: String(options.year) }
    : {};
  const data = await tmdbGet(path, { query, include_adult: "false", page: "1", ...yearParam }, deps);
  const results = Array.isArray(data.results) ? (data.results as Raw[]) : [];
  const normalize = kind === "movie" ? normalizeMovie : normalizeTv;
  return results
    .map(normalize)
    .filter((item): item is ScreenResult => item !== null)
    .slice(0, SEARCH_RESULT_MAX);
}

/** 點選後補導演／製片國家：movie 用 credits，tv 用 created_by + origin_country */
export async function fetchTmdbDetail(
  kind: "movie" | "series",
  tmdbId: number,
  deps: TmdbDeps,
): Promise<TmdbDetail> {
  if (kind === "movie") {
    const data = await tmdbGet(`/movie/${tmdbId}`, { append_to_response: "credits" }, deps);
    const base = normalizeMovie(data);
    if (!base) throw new TmdbError("TMDB 電影資料缺少標題", null);
    const countries = Array.isArray(data.production_countries)
      ? (data.production_countries as Raw[]).map((country) => country.iso_3166_1)
      : [];
    const runtime = runtimeOf(data.runtime);
    return {
      ...toDetail(base),
      region: regionLabel(countries),
      credit: extractDirector(data.credits),
      ...(runtime ? { runtimeMinutes: runtime } : {}),
    };
  }
  const data = await tmdbGet(`/tv/${tmdbId}`, {}, deps);
  const base = normalizeTv(data);
  if (!base) throw new TmdbError("TMDB 影集資料缺少標題", null);
  return { ...toDetail(base), credit: extractCreators(data.created_by) };
}

function toDetail(result: ScreenResult): TmdbDetail {
  return {
    kind: result.kind,
    tmdbId: result.tmdbId,
    title: result.title,
    originalTitle: result.originalTitle,
    year: result.year,
    region: result.region,
    posterUrl: result.posterUrl,
    credit: null,
  };
}

/** 從環境變數組 deps（route 用） */
export function tmdbDepsFromEnv(env: NodeJS.ProcessEnv = process.env): TmdbDeps {
  return {
    fetch,
    readAccessToken: env.TMDB_READ_ACCESS_TOKEN?.trim() || null,
    apiKey: env.TMDB_API_KEY?.trim() || null,
    ...(externalOverridesAllowed(env) && env.TMDB_API_BASE?.trim() ? { baseUrl: env.TMDB_API_BASE.trim().replace(/\/$/, "") } : {}),
  };
}
