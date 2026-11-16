/**
 * 推薦用的 TMDB 詳情（server only）：一部一次請求（credits＋recommendations＋similar 合併），快取 24 小時。
 * 種子與候選共用同一份快取；同時最多 TMDB_CONCURRENCY 個請求。
 */

import { tmdbGet, type TmdbDeps } from "@/lib/work-picker/tmdb";
import { DETAIL_CACHE_MAX, DETAIL_TTL_MS, TMDB_CONCURRENCY } from "./constants";
import { parseTmdbInfo } from "./tmdb-info";
import { createTtlCache } from "./ttl-cache";
import type { ScreenKind, TmdbInfo } from "./types";

const cache = createTtlCache<TmdbInfo>({ ttlMs: DETAIL_TTL_MS, maxEntries: DETAIL_CACHE_MAX });

const APPEND = "credits,recommendations,similar";

export function fetchTmdbInfo(kind: ScreenKind, tmdbId: number, deps: TmdbDeps): Promise<TmdbInfo> {
  const path = kind === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  return cache.get(`${kind}:${tmdbId}`, async () => parseTmdbInfo(kind, await tmdbGet(path, { append_to_response: APPEND }, deps)));
}

export interface InfoRequest {
  key: string;
  kind: ScreenKind;
  tmdbId: number;
}

export interface InfoBatch {
  infos: Map<string, TmdbInfo>;
  failures: string[];
}

/** 一批詳情，限制並發；失敗的留在 failures（交給呼叫端決定要不要整區不顯示） */
export async function fetchInfoBatch(requests: readonly InfoRequest[], deps: TmdbDeps): Promise<InfoBatch> {
  const results: Array<{ key: string; info: TmdbInfo } | { key: string; error: string }> = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < requests.length) {
      const request = requests[cursor];
      cursor += 1;
      try {
        results.push({ key: request.key, info: await fetchTmdbInfo(request.kind, request.tmdbId, deps) });
      } catch (error) {
        results.push({ key: request.key, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(TMDB_CONCURRENCY, requests.length) }, worker));
  return {
    infos: new Map(results.flatMap((result) => ("info" in result ? [[result.key, result.info] as const] : []))),
    failures: results.flatMap((result) => ("error" in result ? [`${result.key}：${result.error}`] : [])),
  };
}
