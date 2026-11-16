import { describe, expect, it, vi } from "vitest";
import type { WatchSnapshot } from "./providers";
import {
  createMemoryCache,
  isFresh,
  podcastListenInfo,
  resolveWatchInfo,
  snapshotToInfo,
  WATCH_CACHE_TTL_MS,
  type WatchDeps,
  type WatchWorkRow,
} from "./service";

const NOW = new Date("2026-10-10T12:00:00Z");
const HOUR = 60 * 60 * 1000;

const NETFLIX: WatchSnapshot = {
  providers: [{ name: "Netflix", kind: "subscription", link: "https://tmdb/watch" }],
  link: "https://tmdb/watch",
  releaseDate: null,
};

function row(overrides: Partial<WatchWorkRow> = {}): WatchWorkRow {
  return {
    id: "w1",
    kind: "series",
    tmdb_id: 93405,
    feed_url: null,
    itunes_id: null,
    watch_providers: null,
    watch_providers_checked_at: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<WatchDeps> = {}): WatchDeps & {
  fetchSnapshot: ReturnType<typeof vi.fn>;
  saveSnapshot: ReturnType<typeof vi.fn>;
  logError: ReturnType<typeof vi.fn>;
} {
  return {
    now: () => NOW,
    memory: createMemoryCache(),
    fetchSnapshot: vi.fn().mockResolvedValue(NETFLIX),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    logError: vi.fn(),
    ...overrides,
  } as never;
}

describe("isFresh", () => {
  it("24 小時內為新鮮", () => {
    expect(isFresh(NOW.getTime() - 23 * HOUR, NOW)).toBe(true);
    expect(isFresh(NOW.getTime() - WATCH_CACHE_TTL_MS, NOW)).toBe(false);
    expect(isFresh(null, NOW)).toBe(false);
  });
});

describe("resolveWatchInfo", () => {
  it("DB 快取新鮮 → 不打 TMDB", async () => {
    const deps = makeDeps();
    const info = await resolveWatchInfo(
      row({ watch_providers: NETFLIX, watch_providers_checked_at: new Date(NOW.getTime() - HOUR).toISOString() }),
      deps,
    );
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
    expect(info).toEqual({
      status: "available",
      platforms: [{ name: "Netflix", note: "訂閱", url: "https://tmdb/watch" }],
      attribution: "資料來源：JustWatch / TMDB",
    });
  });

  it("DB 過期 → 重抓、寫回 DB；第二次走記憶體快取", async () => {
    const deps = makeDeps();
    const stale = row({
      watch_providers: { ...NETFLIX, providers: [] },
      watch_providers_checked_at: new Date(NOW.getTime() - 25 * HOUR).toISOString(),
    });
    await resolveWatchInfo(stale, deps);
    expect(deps.fetchSnapshot).toHaveBeenCalledWith("series", 93405);
    expect(deps.saveSnapshot).toHaveBeenCalledWith("w1", NETFLIX, NOW);
    await resolveWatchInfo(stale, deps);
    expect(deps.fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it("TMDB 失敗 → 無資料態、log 詳細錯誤、不 throw", async () => {
    const error = Object.assign(new Error("TMDB 回應 503"), { status: 503 });
    const deps = makeDeps({ fetchSnapshot: vi.fn().mockRejectedValue(error) });
    await expect(resolveWatchInfo(row({ kind: "movie", tmdb_id: 1 }), deps)).resolves.toEqual({
      status: "none",
      platforms: [],
      attribution: null,
    });
    expect(deps.logError).toHaveBeenCalledWith(
      expect.stringContaining("TMDB"),
      expect.objectContaining({ workId: "w1", tmdbId: 1, status: 503, error: "TMDB 回應 503" }),
    );
    expect(deps.saveSnapshot).not.toHaveBeenCalled();
  });

  it("寫回 DB 失敗仍顯示本次資料，並 log", async () => {
    const deps = makeDeps({ saveSnapshot: vi.fn().mockRejectedValue(new Error("db down")) });
    const info = await resolveWatchInfo(row(), deps);
    expect(info?.status).toBe("available");
    expect(deps.logError).toHaveBeenCalledWith(expect.stringContaining("寫入"), expect.objectContaining({ error: "db down" }));
  });

  it("沒有 tmdb_id 的影視 → 無資料；演出／展覽 → null（不顯示）", async () => {
    const deps = makeDeps();
    expect(await resolveWatchInfo(row({ tmdb_id: null }), deps)).toEqual({ status: "none", platforms: [], attribution: null });
    expect(await resolveWatchInfo(row({ kind: "live" }), deps)).toBeNull();
    expect(await resolveWatchInfo(row({ kind: "exhibition" }), deps)).toBeNull();
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });

  it("Podcast → 在哪聽（不打 TMDB）", async () => {
    const deps = makeDeps();
    const info = await resolveWatchInfo(
      row({ kind: "podcast_episode", tmdb_id: null, itunes_id: 1200361736, feed_url: "https://feeds.example/a.xml" }),
      deps,
    );
    expect(info?.platforms.map((p) => p.url)).toEqual([
      "https://podcasts.apple.com/tw/podcast/id1200361736",
      "https://feeds.example/a.xml",
    ]);
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });
});

describe("podcastListenInfo", () => {
  it("沒有 itunes_id 也沒有 feed_url → 無資料（不放假連結）", () => {
    expect(podcastListenInfo({ itunes_id: null, feed_url: null })).toEqual({
      status: "none",
      platforms: [],
      attribution: null,
    });
  });
  it("只有 feed_url → 只列 RSS", () => {
    expect(podcastListenInfo({ itunes_id: null, feed_url: "https://f" }).platforms).toEqual([
      { name: "RSS", note: "訂閱網址", url: "https://f" },
    ]);
  });
});

describe("snapshotToInfo", () => {
  it("上映中不列平台、不標註，帶上映日", () => {
    expect(snapshotToInfo({ providers: [], link: null, releaseDate: "2026-10-01" }, NOW)).toEqual({
      status: "in_theaters",
      platforms: [],
      attribution: null,
      since: "2026-10-01",
    });
  });
});

describe("createMemoryCache", () => {
  it("超過容量淘汰最早寫入", () => {
    const cache = createMemoryCache(2);
    cache.set("a", { snapshot: NETFLIX, checkedAt: 1 });
    cache.set("b", { snapshot: NETFLIX, checkedAt: 1 });
    cache.set("c", { snapshot: NETFLIX, checkedAt: 1 });
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBeDefined();
  });
});
