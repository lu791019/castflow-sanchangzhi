/**
 * Apple iTunes Search（podcast，免金鑰）。限速約 20 次/分 → server 端記憶體快取（key=term，TTL ≥10 分）。
 * 同名節目很多，列表要帶封面＋作者＋集數供辨識（data-feasibility.md 第二節）。
 */

import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit/token-bucket";
import { normalizeQuery } from "./query";
import type { PodcastShowResult } from "./types";

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";
const ITUNES_TIMEOUT_MS = 8_000;
const RESULT_MAX = 20;
export const ITUNES_CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 200;
/** iTunes 官方約 20 次/分；server 端全域留 2 次餘裕 */
export const ITUNES_GLOBAL_PER_MINUTE = 18;
export const ITUNES_RATE_LIMITED_STATUS = 429;

export class ItunesError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "ItunesError";
  }
}

export interface TtlCache<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
}

/** 簡單 TTL 快取：過期即丟；超過容量淘汰最早寫入的 */
export function createTtlCache<T>(
  ttlMs: number,
  now: () => number = Date.now,
  maxEntries = CACHE_MAX_ENTRIES,
): TtlCache<T> {
  const store = new Map<string, { value: T; expiresAt: number }>();
  return {
    get: (key) => {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set: (key, value) => {
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: now() + ttlMs });
    },
  };
}

export interface ItunesDeps {
  fetch: typeof fetch;
  cache: TtlCache<PodcastShowResult[]>;
  /** 全域限流（快取未命中才扣）；超過丟 ItunesError(status 429)，不打上游 */
  limiter?: RateLimiter;
}

type Raw = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizePodcast(raw: Raw): PodcastShowResult | null {
  const name = text(raw.collectionName);
  const feedUrl = text(raw.feedUrl);
  if (typeof raw.collectionId !== "number" || !name || !feedUrl) return null;
  return {
    kind: "podcast",
    itunesId: raw.collectionId,
    name,
    artist: text(raw.artistName),
    trackCount: typeof raw.trackCount === "number" ? raw.trackCount : null,
    artworkUrl: text(raw.artworkUrl600) ?? text(raw.artworkUrl100),
    feedUrl,
  };
}

/** media=podcast&country=tw；同 term 走快取 */
export async function searchPodcasts(term: string, deps: ItunesDeps): Promise<PodcastShowResult[]> {
  const key = normalizeQuery(term).toLocaleLowerCase();
  const cached = deps.cache.get(key);
  if (cached) return cached;

  if (deps.limiter && !deps.limiter.take("itunes").allowed) {
    throw new ItunesError("iTunes 全域限流：每分鐘超過上限且無快取", ITUNES_RATE_LIMITED_STATUS);
  }

  const url = new URL(ITUNES_SEARCH);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("country", "tw");
  url.searchParams.set("limit", String(RESULT_MAX));
  url.searchParams.set("term", key);

  const data = await fetchItunesJson(url, deps);
  const results = (Array.isArray(data.results) ? (data.results as Raw[]) : [])
    .map(normalizePodcast)
    .filter((item): item is PodcastShowResult => item !== null)
    .slice(0, RESULT_MAX);
  deps.cache.set(key, results);
  return results;
}

export interface ItunesLookupDeps {
  fetch: typeof fetch;
  /** key=itunesId；查無也快取（null），避免同一節目反覆打上游 */
  cache: TtlCache<string | null>;
  limiter?: RateLimiter;
}

export async function fetchItunesJson(url: URL, deps: Pick<ItunesDeps, "fetch">): Promise<Raw> {
  let response: Response;
  try {
    response = await deps.fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(ITUNES_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new ItunesError(error instanceof Error ? error.message : "iTunes 連線失敗", null);
  }
  if (!response.ok) throw new ItunesError(`iTunes 回應 ${response.status}`, response.status);
  return (await response.json()) as Raw;
}

/** 節目封面（封面補齊）：iTunes lookup → artworkUrl600（沒有退 100）；查無回 null */
export async function lookupPodcastArtwork(itunesId: number, deps: ItunesLookupDeps): Promise<string | null> {
  const key = String(itunesId);
  const cached = deps.cache.get(key);
  if (cached !== undefined) return cached;

  if (deps.limiter && !deps.limiter.take("itunes").allowed) {
    throw new ItunesError("iTunes 全域限流：每分鐘超過上限且無快取", ITUNES_RATE_LIMITED_STATUS);
  }

  const url = new URL(ITUNES_LOOKUP);
  url.searchParams.set("id", key);
  url.searchParams.set("entity", "podcast");
  url.searchParams.set("country", "tw");
  const data = await fetchItunesJson(url, deps);
  const hit = (Array.isArray(data.results) ? (data.results as Raw[]) : []).find((raw) => raw.collectionId === itunesId);
  const artwork = hit ? (text(hit.artworkUrl600) ?? text(hit.artworkUrl100)) : null;
  deps.cache.set(key, artwork);
  return artwork;
}

/** 模組層快取：同一個 server process 內跨請求共用 */
const sharedCache = createTtlCache<PodcastShowResult[]>(ITUNES_CACHE_TTL_MS);
const sharedLimiter = createRateLimiter({ capacity: ITUNES_GLOBAL_PER_MINUTE, windowMs: 60_000 });

export function itunesDepsFromEnv(): ItunesDeps {
  return { fetch, cache: sharedCache, limiter: sharedLimiter };
}

const sharedArtworkCache = createTtlCache<string | null>(ITUNES_CACHE_TTL_MS);

export function itunesLookupDepsFromEnv(): ItunesLookupDeps {
  return { fetch, cache: sharedArtworkCache, limiter: sharedLimiter };
}

/** 是否為我方全域限流（route 據此回 429 而非 502） */
export function isItunesRateLimited(error: unknown): boolean {
  return error instanceof ItunesError && error.status === ITUNES_RATE_LIMITED_STATUS;
}
