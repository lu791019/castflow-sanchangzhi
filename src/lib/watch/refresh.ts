/**
 * 「在哪看」每日更新：worker 每輪呼叫 /api/works/watch/refresh，
 * 這裡挑出快取過期（或從未查過）的影劇作品重抓 TMDB，頁面就不必在請求時等外部 API。
 * 單筆失敗不中斷；失敗數回給 worker 推警報（不靜默）。
 */

import type { WatchSnapshot } from "./providers";
import { WATCH_CACHE_TTL_MS } from "./service";

/** 每輪最多更新幾筆（TMDB 約 40 req/s，這裡保守） */
export const WATCH_REFRESH_LIMIT = 10;

export interface StaleWork {
  id: string;
  kind: "movie" | "series";
  tmdb_id: number;
}

export interface RefreshDeps {
  /** checked_at 為空或早於 cutoff 的影劇作品，舊的先 */
  listStale(cutoffIso: string, limit: number): Promise<StaleWork[]>;
  fetchSnapshot(kind: StaleWork["kind"], tmdbId: number): Promise<WatchSnapshot>;
  saveSnapshot(workId: string, snapshot: WatchSnapshot, checkedAt: Date): Promise<void>;
  logError(message: string, context: Record<string, unknown>): void;
}

export interface RefreshResult {
  scanned: number;
  updated: number;
  failed: number;
  errors: string[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runWatchRefresh(
  deps: RefreshDeps,
  now: Date,
  limit = WATCH_REFRESH_LIMIT,
): Promise<RefreshResult> {
  const cutoff = new Date(now.getTime() - WATCH_CACHE_TTL_MS).toISOString();
  const stale = await deps.listStale(cutoff, limit);
  let result: RefreshResult = { scanned: stale.length, updated: 0, failed: 0, errors: [] };
  for (const work of stale) {
    try {
      const snapshot = await deps.fetchSnapshot(work.kind, work.tmdb_id);
      await deps.saveSnapshot(work.id, snapshot, now);
      result = { ...result, updated: result.updated + 1 };
    } catch (error) {
      deps.logError("[watch] 每日更新失敗", { workId: work.id, error: messageOf(error) });
      result = {
        ...result,
        failed: result.failed + 1,
        errors: [...result.errors, `${work.id}：${messageOf(error)}`],
      };
    }
  }
  return result;
}
