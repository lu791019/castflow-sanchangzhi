/**
 * 「在哪看／在哪聽」組裝：記憶體 + DB 兩層快取（TTL 24h），過期才重抓 TMDB。
 * 失敗一律降成「無資料」態並寫詳細 server log，不 throw 到頁面。
 * 依賴全部注入，純邏輯可測；實際接線在 repository.ts。
 */

import { musicListenInfo } from "@/lib/links/music-links";
import type { WorkKind } from "@/lib/works/format";
import {
  deriveWatchStatus,
  PROVIDER_KIND_LABELS,
  WATCH_ATTRIBUTION,
  type WatchSnapshot,
  type WatchStatus,
} from "./providers";

export const WATCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PlatformRow {
  name: string;
  note: string;
  url: string | null;
}

/** 傳給 InfoBox 的 props（只有這些） */
export interface WatchInfo {
  status: WatchStatus;
  platforms: PlatformRow[];
  /** 底部來源標註；null = 不顯示 */
  attribution: string | null;
  /** 上映中時的上映日 YYYY-MM-DD（「院線・10.03 起」） */
  since?: string | null;
}

export const NO_WATCH_INFO: WatchInfo = { status: "none", platforms: [], attribution: null };

export interface WatchWorkRow {
  id: string;
  kind: WorkKind;
  tmdb_id: number | null;
  feed_url: string | null;
  itunes_id: number | null;
  watch_providers: WatchSnapshot | null;
  watch_providers_checked_at: string | null;
  /** 音樂「在哪聽」組搜尋字用（專輯名、歌手） */
  title?: string;
  credit?: string | null;
}

export interface MemoryCache {
  get: (key: string) => { snapshot: WatchSnapshot; checkedAt: number } | undefined;
  set: (key: string, value: { snapshot: WatchSnapshot; checkedAt: number }) => void;
}

export interface WatchDeps {
  now: () => Date;
  memory: MemoryCache;
  fetchSnapshot: (kind: "movie" | "series", tmdbId: number) => Promise<WatchSnapshot>;
  saveSnapshot: (workId: string, snapshot: WatchSnapshot, checkedAt: Date) => Promise<void>;
  logError: (message: string, context: Record<string, unknown>) => void;
}

export function isFresh(checkedAt: number | null, now: Date, ttlMs = WATCH_CACHE_TTL_MS): boolean {
  return checkedAt !== null && now.getTime() - checkedAt < ttlMs;
}

export function createMemoryCache(maxEntries = 500): MemoryCache {
  const store = new Map<string, { snapshot: WatchSnapshot; checkedAt: number }>();
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      if (!store.has(key) && store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, value);
    },
  };
}

export function snapshotToInfo(snapshot: WatchSnapshot | null, now: Date): WatchInfo {
  const status = deriveWatchStatus(snapshot, now);
  if (status === "in_theaters" && snapshot) {
    return { status, platforms: [], attribution: null, since: snapshot.releaseDate };
  }
  if (status !== "available" || !snapshot) return { status, platforms: [], attribution: null };
  return {
    status,
    platforms: snapshot.providers.map((provider) => ({
      name: provider.name,
      note: PROVIDER_KIND_LABELS[provider.kind],
      url: provider.link,
    })),
    attribution: WATCH_ATTRIBUTION,
  };
}

/** Podcast「在哪聽」：Apple Podcasts（itunes_id）、RSS（feed_url）；Spotify/KKBOX 無金鑰暫不做，不放假連結 */
export function podcastListenInfo(work: Pick<WatchWorkRow, "itunes_id" | "feed_url">): WatchInfo {
  const candidates: Array<PlatformRow | null> = [
    work.itunes_id
      ? {
          name: "Apple Podcasts",
          note: "免費",
          url: `https://podcasts.apple.com/tw/podcast/id${work.itunes_id}`,
        }
      : null,
    work.feed_url ? { name: "RSS", note: "訂閱網址", url: work.feed_url } : null,
  ];
  const platforms = candidates.filter((row): row is PlatformRow => row !== null);
  return platforms.length > 0
    ? { status: "available", platforms, attribution: null }
    : NO_WATCH_INFO;
}

async function resolveSnapshot(
  work: WatchWorkRow & { kind: "movie" | "series"; tmdb_id: number },
  deps: WatchDeps,
): Promise<WatchSnapshot | null> {
  const now = deps.now();
  const key = `${work.kind}:${work.tmdb_id}`;
  const memo = deps.memory.get(key);
  if (memo && isFresh(memo.checkedAt, now)) return memo.snapshot;

  const dbCheckedAt = work.watch_providers_checked_at
    ? Date.parse(work.watch_providers_checked_at)
    : null;
  if (work.watch_providers && dbCheckedAt !== null && isFresh(dbCheckedAt, now)) {
    deps.memory.set(key, { snapshot: work.watch_providers, checkedAt: dbCheckedAt });
    return work.watch_providers;
  }

  let snapshot: WatchSnapshot;
  try {
    snapshot = await deps.fetchSnapshot(work.kind, work.tmdb_id);
  } catch (error) {
    deps.logError("[watch] TMDB watch providers 失敗，資訊欄降為無資料", {
      workId: work.id,
      kind: work.kind,
      tmdbId: work.tmdb_id,
      error: error instanceof Error ? error.message : String(error),
      status: (error as { status?: unknown })?.status ?? null,
    });
    return null;
  }
  deps.memory.set(key, { snapshot, checkedAt: now.getTime() });
  try {
    await deps.saveSnapshot(work.id, snapshot, now);
  } catch (error) {
    // 寫回失敗不影響本次顯示，但要留痕（下次會再抓）
    deps.logError("[watch] 寫入 watch_providers 快取失敗", {
      workId: work.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return snapshot;
}

/** 依作品類型回 InfoBox 用資料；現場類（演出／展覽）回 null = 不顯示「在哪看」 */
export async function resolveWatchInfo(
  work: WatchWorkRow,
  deps: WatchDeps,
): Promise<WatchInfo | null> {
  if (work.kind === "live" || work.kind === "exhibition") return null;
  if (work.kind === "podcast_episode") return podcastListenInfo(work);
  if (work.kind === "music") return musicListenInfo({ title: work.title ?? "", credit: work.credit ?? null, itunes_id: work.itunes_id });
  if (work.tmdb_id === null) return NO_WATCH_INFO;
  const snapshot = await resolveSnapshot({ ...work, kind: work.kind, tmdb_id: work.tmdb_id }, deps);
  return snapshotToInfo(snapshot, deps.now());
}
