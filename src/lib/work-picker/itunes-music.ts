/**
 * 音樂（專輯）：iTunes Search entity=album、lookup 取回單張（免金鑰）。
 * 跟 Podcast 搜尋共用同一個全域限流（iTunes 約 20 次/分），快取各自一份（key=term／collectionId）。
 * 單曲先不做：Apple 的「- Single」「- EP」本身也是一張專輯，照列，只把字尾拿掉。
 */

import { safeImageUrl } from "@/lib/covers/cover";
import type { RateLimiter } from "@/lib/rate-limit/token-bucket";
import {
  createTtlCache,
  fetchItunesJson,
  ITUNES_CACHE_TTL_MS,
  ITUNES_RATE_LIMITED_STATUS,
  ItunesError,
  itunesDepsFromEnv,
  type TtlCache,
} from "./itunes";
import { normalizeQuery } from "./query";
import type { MusicAlbumResult } from "./types";
import { externalOverridesAllowed } from "@/lib/e2e-overrides";

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";
const RESULT_MAX = 20;
/** mzstatic 封面網址最後一段是尺寸（100x100bb.jpg），換成 600 拿大圖 */
const ARTWORK_SIZE = /\/\d+x\d+bb\.(jpg|png|webp)$/;
const TITLE_SUFFIX = / - (Single|EP)$/;

type Raw = Record<string, unknown>;

export interface MusicUrls {
  /** 只給本機 E2E 指到假 iTunes（itunesMusicUrlsFromEnv）；預設官方 */
  searchUrl?: string;
  lookupUrl?: string;
}

export interface MusicSearchDeps extends MusicUrls {
  fetch: typeof fetch;
  cache: TtlCache<MusicAlbumResult[]>;
  limiter?: RateLimiter;
}

export interface MusicLookupDeps extends MusicUrls {
  fetch: typeof fetch;
  /** key=collectionId；查無也快取（null） */
  cache: TtlCache<MusicAlbumResult | null>;
  limiter?: RateLimiter;
}

/** env ITUNES_SEARCH_URL／ITUNES_LOOKUP_URL：非 production 才生效（比照 APPLE_TOP_URL） */
export function itunesMusicUrlsFromEnv(env: Record<string, string | undefined> = process.env): MusicUrls {
  if (!externalOverridesAllowed(env)) return {};
  const searchUrl = env.ITUNES_SEARCH_URL?.trim();
  const lookupUrl = env.ITUNES_LOOKUP_URL?.trim();
  return { ...(searchUrl ? { searchUrl } : {}), ...(lookupUrl ? { lookupUrl } : {}) };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function cleanAlbumTitle(title: string): string {
  return title.replace(TITLE_SUFFIX, "").trim();
}

export function albumArtwork(url: unknown): string | null {
  const safe = safeImageUrl(typeof url === "string" ? url : null);
  return safe ? safe.replace(ARTWORK_SIZE, "/600x600bb.$1") : null;
}

function yearOf(raw: unknown): number | null {
  const match = typeof raw === "string" ? /^(\d{4})/.exec(raw) : null;
  return match ? Number(match[1]) : null;
}

export function normalizeAlbum(raw: Raw): MusicAlbumResult | null {
  const name = text(raw.collectionName);
  if (raw.wrapperType !== "collection" || typeof raw.collectionId !== "number" || !name) return null;
  return {
    kind: "music",
    itunesId: raw.collectionId,
    title: cleanAlbumTitle(name),
    artist: text(raw.artistName),
    year: yearOf(raw.releaseDate),
    trackCount: typeof raw.trackCount === "number" ? raw.trackCount : null,
    artworkUrl: albumArtwork(raw.artworkUrl100 ?? raw.artworkUrl60),
    feelingCount: 0,
  };
}

function takeToken(limiter: RateLimiter | undefined): void {
  if (limiter && !limiter.take("itunes").allowed) {
    throw new ItunesError("iTunes 全域限流：每分鐘超過上限且無快取", ITUNES_RATE_LIMITED_STATUS);
  }
}

function albumsOf(data: Raw): MusicAlbumResult[] {
  return (Array.isArray(data.results) ? (data.results as Raw[]) : [])
    .map(normalizeAlbum)
    .filter((item): item is MusicAlbumResult => item !== null);
}

/** entity=album&country=tw；同 term 走快取 */
export async function searchAlbums(term: string, deps: MusicSearchDeps): Promise<MusicAlbumResult[]> {
  const key = normalizeQuery(term).toLocaleLowerCase();
  const cached = deps.cache.get(key);
  if (cached) return cached;
  takeToken(deps.limiter);

  const url = new URL(deps.searchUrl ?? ITUNES_SEARCH);
  url.searchParams.set("entity", "album");
  url.searchParams.set("country", "tw");
  url.searchParams.set("limit", String(RESULT_MAX));
  url.searchParams.set("term", key);
  const results = albumsOf(await fetchItunesJson(url, deps)).slice(0, RESULT_MAX);
  deps.cache.set(key, results);
  return results;
}

/** 選定專輯時以 collectionId 取回標準資料（不信任前端送來的名稱）；查無回 null */
export async function lookupAlbum(itunesId: number, deps: MusicLookupDeps): Promise<MusicAlbumResult | null> {
  const key = String(itunesId);
  const cached = deps.cache.get(key);
  if (cached !== undefined) return cached;
  takeToken(deps.limiter);

  const url = new URL(deps.lookupUrl ?? ITUNES_LOOKUP);
  url.searchParams.set("id", key);
  url.searchParams.set("entity", "album");
  url.searchParams.set("country", "tw");
  const album = albumsOf(await fetchItunesJson(url, deps)).find((item) => item.itunesId === itunesId) ?? null;
  deps.cache.set(key, album);
  return album;
}

/** 模組層快取：同一個 server process 內跨請求共用；限流與 Podcast 搜尋同一個桶 */
const sharedSearchCache = createTtlCache<MusicAlbumResult[]>(ITUNES_CACHE_TTL_MS);
const sharedLookupCache = createTtlCache<MusicAlbumResult | null>(ITUNES_CACHE_TTL_MS);

export function musicSearchDepsFromEnv(): MusicSearchDeps {
  const { fetch: doFetch, limiter } = itunesDepsFromEnv();
  return { fetch: doFetch, cache: sharedSearchCache, limiter, ...itunesMusicUrlsFromEnv() };
}

export function musicLookupDepsFromEnv(): MusicLookupDeps {
  const { fetch: doFetch, limiter } = itunesDepsFromEnv();
  return { fetch: doFetch, cache: sharedLookupCache, limiter, ...itunesMusicUrlsFromEnv() };
}
