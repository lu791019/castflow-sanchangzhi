/** 「在哪看」接線：service role 讀寫 works 的 watch 欄位、模組層記憶體快取（server only） */

import { createAdminClient } from "@/lib/supabase/admin";
import { tmdbDepsFromEnv } from "@/lib/work-picker/tmdb";
import { fetchWatchSnapshot, parseStoredSnapshot, type WatchSnapshot } from "./providers";
import { runWatchRefresh, type RefreshResult, type StaleWork } from "./refresh";
import {
  createMemoryCache,
  NO_WATCH_INFO,
  resolveWatchInfo,
  type WatchDeps,
  type WatchInfo,
  type WatchWorkRow,
} from "./service";

const WATCH_COLUMNS =
  "id, kind, title, credit, tmdb_id, feed_url, itunes_id, watch_providers, watch_providers_checked_at";

/** 同一個 server process 內跨請求共用 */
const memory = createMemoryCache();

function logError(message: string, context: Record<string, unknown>): void {
  console.error(message, context);
}

async function saveSnapshot(workId: string, snapshot: WatchSnapshot, checkedAt: Date): Promise<void> {
  const { error } = await createAdminClient()
    .from("works")
    .update({ watch_providers: snapshot, watch_providers_checked_at: checkedAt.toISOString() })
    .eq("id", workId);
  if (error) throw new Error(error.message);
}

function defaultDeps(): WatchDeps {
  const tmdb = tmdbDepsFromEnv();
  return {
    now: () => new Date(),
    memory,
    fetchSnapshot: (kind, tmdbId) => fetchWatchSnapshot(kind, tmdbId, tmdb),
    saveSnapshot,
    logError,
  };
}

/** 作品 → InfoBox 用的「在哪看／在哪聽」；null = 該類型不顯示（演出／展覽）。任何失敗降為無資料 */
export async function loadWatchInfo(workId: string): Promise<WatchInfo | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("works")
      .select(WATCH_COLUMNS)
      .eq("id", workId)
      .maybeSingle();
    if (error || !data) {
      logError("[watch] 讀取作品 watch 欄位失敗", { workId, error: error?.message ?? "not found" });
      return NO_WATCH_INFO;
    }
    const row: WatchWorkRow = {
      ...(data as Omit<WatchWorkRow, "watch_providers">),
      watch_providers: parseStoredSnapshot((data as { watch_providers: unknown }).watch_providers),
    };
    return await resolveWatchInfo(row, defaultDeps());
  } catch (error) {
    logError("[watch] loadWatchInfo 例外，資訊欄降為無資料", {
      workId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NO_WATCH_INFO;
  }
}

async function listStaleWatchWorks(cutoffIso: string, limit: number): Promise<StaleWork[]> {
  const { data, error } = await createAdminClient()
    .from("works")
    .select("id, kind, tmdb_id")
    .in("kind", ["movie", "series"])
    .not("tmdb_id", "is", null)
    .or(`watch_providers_checked_at.is.null,watch_providers_checked_at.lt.${cutoffIso}`)
    .order("watch_providers_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`讀取待更新作品失敗：${error.message}`);
  return (data ?? []) as StaleWork[];
}

/** worker 每輪呼叫：過期的影劇作品重抓 TMDB 並寫回（同時更新本 process 的記憶體快取不必要，下次讀 DB 即新） */
export function refreshStaleWatchInfo(now: Date = new Date()): Promise<RefreshResult> {
  const tmdb = tmdbDepsFromEnv();
  return runWatchRefresh(
    {
      listStale: listStaleWatchWorks,
      fetchSnapshot: (kind, tmdbId) => fetchWatchSnapshot(kind, tmdbId, tmdb),
      saveSnapshot,
      logError,
    },
    now,
  );
}

