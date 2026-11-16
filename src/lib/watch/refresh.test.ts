import { describe, expect, it, vi } from "vitest";
import { runWatchRefresh, WATCH_REFRESH_LIMIT, type RefreshDeps } from "./refresh";
import { WATCH_CACHE_TTL_MS } from "./service";

const NOW = new Date("2026-10-10T12:00:00Z");
const SNAPSHOT = { providers: [], link: null, releaseDate: null };

function deps(overrides: Partial<RefreshDeps> = {}): RefreshDeps {
  return {
    listStale: vi.fn(async () => [
      { id: "w1", kind: "movie" as const, tmdb_id: 315846 },
      { id: "w2", kind: "series" as const, tmdb_id: 93405 },
    ]),
    fetchSnapshot: vi.fn(async () => SNAPSHOT),
    saveSnapshot: vi.fn(async () => {}),
    logError: vi.fn(),
    ...overrides,
  };
}

describe("runWatchRefresh", () => {
  it("撈過期（checked_at 早於 now-24h 或從未查）的作品，逐筆重抓並寫回", async () => {
    const d = deps();
    const result = await runWatchRefresh(d, NOW);
    expect(d.listStale).toHaveBeenCalledWith(new Date(NOW.getTime() - WATCH_CACHE_TTL_MS).toISOString(), WATCH_REFRESH_LIMIT);
    expect(d.fetchSnapshot).toHaveBeenCalledWith("movie", 315846);
    expect(d.fetchSnapshot).toHaveBeenCalledWith("series", 93405);
    expect(d.saveSnapshot).toHaveBeenCalledWith("w1", SNAPSHOT, NOW);
    expect(result).toEqual({ scanned: 2, updated: 2, failed: 0, errors: [] });
  });

  it("單筆失敗不中斷其他筆，失敗數與原因回報給呼叫端（由 worker 推警報）", async () => {
    const d = deps({
      fetchSnapshot: vi.fn(async (_kind, id: number) => {
        if (id === 315846) throw new Error("TMDB 503");
        return SNAPSHOT;
      }),
    });
    const result = await runWatchRefresh(d, NOW);
    expect(result.updated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(["w1：TMDB 503"]);
    expect(d.logError).toHaveBeenCalled();
  });

  it("沒有過期作品就什麼都不打", async () => {
    const d = deps({ listStale: vi.fn(async () => []) });
    expect(await runWatchRefresh(d, NOW)).toEqual({ scanned: 0, updated: 0, failed: 0, errors: [] });
    expect(d.fetchSnapshot).not.toHaveBeenCalled();
  });
});
