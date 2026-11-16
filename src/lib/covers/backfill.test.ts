import { describe, expect, it, vi } from "vitest";
import { coverRetryBefore, runCoverBackfill, type CoverBackfillDeps, type PendingCover } from "./backfill";

const NOW = new Date("2026-10-13T12:00:00Z");

function work(overrides: Partial<PendingCover> = {}): PendingCover {
  return { id: "w1", title: "EP1", itunesId: 42, feedUrl: "https://f/a.xml", ...overrides };
}

function makeDeps(overrides: Partial<CoverBackfillDeps> = {}): CoverBackfillDeps {
  return {
    listPending: vi.fn(async () => [work()]),
    lookupArtwork: vi.fn(async () => "https://is1/600.jpg"),
    feedImage: vi.fn(async () => "https://feed/cover.jpg"),
    save: vi.fn(async () => undefined),
    markChecked: vi.fn(async () => undefined),
    notify: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe("coverRetryBefore", () => {
  it("查過沒圖的 7 天後再試", () => {
    expect(coverRetryBefore(NOW)).toBe("2026-10-06T12:00:00.000Z");
  });
});

describe("runCoverBackfill", () => {
  it("iTunes 有圖 → 寫入，不讀 feed", async () => {
    const deps = makeDeps();
    const result = await runCoverBackfill(deps, NOW);
    expect(deps.save).toHaveBeenCalledWith("w1", "https://is1/600.jpg");
    expect(deps.feedImage).not.toHaveBeenCalled();
    expect(result).toMatchObject({ scanned: 1, filled: 1, missing: 0, failed: 0 });
  });

  it("沒有 itunes_id 或 iTunes 查無 → 讀 feed 的 itunes:image", async () => {
    const deps = makeDeps({
      listPending: vi.fn(async () => [work({ itunesId: null }), work({ id: "w2" })]),
      lookupArtwork: vi.fn(async () => null),
    });
    const result = await runCoverBackfill(deps, NOW);
    expect(deps.lookupArtwork).toHaveBeenCalledTimes(1);
    expect(deps.save).toHaveBeenCalledWith("w1", "https://feed/cover.jpg");
    expect(deps.save).toHaveBeenCalledWith("w2", "https://feed/cover.jpg");
    expect(result.filled).toBe(2);
  });

  it("同一個 feed 一輪只讀一次", async () => {
    const deps = makeDeps({
      listPending: vi.fn(async () => [work({ itunesId: null }), work({ id: "w2", itunesId: null })]),
    });
    await runCoverBackfill(deps, NOW);
    expect(deps.feedImage).toHaveBeenCalledTimes(1);
  });

  it("兩邊都確定沒有圖 → 標記查過（之後再試），不寫入", async () => {
    const deps = makeDeps({ lookupArtwork: vi.fn(async () => null), feedImage: vi.fn(async () => null) });
    const result = await runCoverBackfill(deps, NOW);
    expect(deps.markChecked).toHaveBeenCalledWith("w1");
    expect(deps.save).not.toHaveBeenCalled();
    expect(result.missing).toBe(1);
  });

  it("上游失敗且沒拿到圖 → 不標記（下一輪重試）並推警報", async () => {
    const deps = makeDeps({
      lookupArtwork: vi.fn(async () => {
        throw new Error("iTunes 回應 503");
      }),
      feedImage: vi.fn(async () => {
        throw new Error("feed 逾時");
      }),
    });
    const result = await runCoverBackfill(deps, NOW);
    expect(deps.markChecked).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("iTunes 回應 503");
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("封面"), expect.stringContaining("feed 逾時"));
  });

  it("iTunes 失敗但 feed 有圖 → 照樣寫入，仍推警報", async () => {
    const deps = makeDeps({
      lookupArtwork: vi.fn(async () => {
        throw new Error("iTunes 回應 503");
      }),
    });
    const result = await runCoverBackfill(deps, NOW);
    expect(deps.save).toHaveBeenCalledWith("w1", "https://feed/cover.jpg");
    expect(result.filled).toBe(1);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it("寫入失敗計 failed、繼續下一筆", async () => {
    const deps = makeDeps({
      listPending: vi.fn(async () => [work(), work({ id: "w2" })]),
      save: vi.fn(async (id: string) => {
        if (id === "w1") throw new Error("db down");
      }),
    });
    const result = await runCoverBackfill(deps, NOW);
    expect(result).toMatchObject({ scanned: 2, filled: 1, failed: 1 });
  });

  it("讀待補清單用 7 天前當重試門檻", async () => {
    const deps = makeDeps({ listPending: vi.fn(async () => []) });
    await runCoverBackfill(deps, NOW);
    expect(deps.listPending).toHaveBeenCalledWith(10, "2026-10-06T12:00:00.000Z");
  });
});
