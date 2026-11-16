/**
 * Podcast 本週熱門：Apple Podcasts 台灣 Top 30（官方榜單 JSON，免金鑰）。
 * 榜單只有 id／名稱／封面，沒有 RSS，所以再用 iTunes lookup 一次補齊 feedUrl（選擇器選節目要列集數）。
 */

import { ItunesError, normalizePodcast } from "@/lib/work-picker/itunes";
import type { PodcastShowResult } from "@/lib/work-picker/types";
import { externalOverridesAllowed } from "@/lib/e2e-overrides";

export const APPLE_TOP_URL = "https://rss.marketingtools.apple.com/api/v2/tw/podcasts/top/30/podcasts.json";
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";
/** Apple 榜單從 Cloud Run（彰化）冷抓偶爾超過 8 秒（10/13 上線第一刻就撞到），放寬到 15 秒；之後都是快取 */
const TIMEOUT_MS = 15_000;

type Raw = Record<string, unknown>;

export interface AppleTopDeps {
  fetch: typeof fetch;
  /** 只給本機 E2E 指到假 Apple（appleTopUrlsFromEnv）；預設官方 */
  topUrl?: string;
  lookupUrl?: string;
}

/** env APPLE_TOP_URL／ITUNES_LOOKUP_URL：非 production 才生效（比照 TMDB_API_BASE） */
export function appleTopUrlsFromEnv(env: Record<string, string | undefined> = process.env): Pick<AppleTopDeps, "topUrl" | "lookupUrl"> {
  if (!externalOverridesAllowed(env)) return {};
  const topUrl = env.APPLE_TOP_URL?.trim();
  const lookupUrl = env.ITUNES_LOOKUP_URL?.trim();
  return { ...(topUrl ? { topUrl } : {}), ...(lookupUrl ? { lookupUrl } : {}) };
}

/** 榜單 JSON → 依名次排列的 itunesId；壞資料跳過 */
export function parseAppleTopIds(data: unknown): number[] {
  const feed = (data as Raw | null)?.feed as Raw | undefined;
  const results = Array.isArray(feed?.results) ? (feed.results as Raw[]) : [];
  return results.flatMap((row) => {
    const id = typeof row.id === "string" ? Number.parseInt(row.id, 10) : typeof row.id === "number" ? row.id : Number.NaN;
    return Number.isInteger(id) && id > 0 ? [id] : [];
  });
}

async function getJson(url: string, deps: AppleTopDeps, label: string): Promise<unknown> {
  let response: Response;
  try {
    response = await deps.fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new ItunesError(error instanceof Error ? `${label}：${error.message}` : `${label} 連線失敗`, null);
  }
  if (!response.ok) throw new ItunesError(`${label} 回應 ${response.status}`, response.status);
  return response.json();
}

/** lookup 一批 id（country=tw）；回傳依傳入順序排列、拿得到 feedUrl 的節目 */
export async function lookupPodcasts(ids: readonly number[], deps: AppleTopDeps): Promise<PodcastShowResult[]> {
  if (ids.length === 0) return [];
  const url = new URL(deps.lookupUrl ?? ITUNES_LOOKUP);
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("country", "tw");
  url.searchParams.set("entity", "podcast");
  const data = (await getJson(url.toString(), deps, "iTunes lookup")) as Raw;
  const byId = new Map<number, PodcastShowResult>();
  for (const raw of Array.isArray(data.results) ? (data.results as Raw[]) : []) {
    const show = normalizePodcast(raw);
    if (show) byId.set(show.itunesId, show);
  }
  return ids.flatMap((id) => {
    const show = byId.get(id);
    return show ? [show] : [];
  });
}

export async function loadTrendingPodcasts(deps: AppleTopDeps): Promise<PodcastShowResult[]> {
  const ids = parseAppleTopIds(await getJson(deps.topUrl ?? APPLE_TOP_URL, deps, "Apple 榜單"));
  if (ids.length === 0) throw new ItunesError("Apple 榜單是空的", null);
  const shows = await lookupPodcasts(ids, deps);
  if (shows.length === 0) throw new ItunesError("Apple 榜單的節目都查不到 RSS", null);
  return shows;
}
