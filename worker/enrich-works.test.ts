import { describe, expect, it, vi } from "vitest";
import type { ScreenResult } from "../src/lib/work-picker/types.ts";
import type { TmdbDetail } from "../src/lib/work-picker/tmdb.ts";
import {
  buildPatch,
  decideMatch,
  normalizeTitle,
  runEnrichBatch,
  UniqueViolationError,
  type EnrichDeps,
  type PendingWork,
} from "./enrich-works.ts";

function result(title: string, tmdbId: number, originalTitle: string | null = null): ScreenResult {
  return { kind: "movie", tmdbId, title, originalTitle, year: 2008, region: null, posterUrl: null, releaseDate: null, feelingCount: 0 };
}

const CAPE_NO_7: TmdbDetail = {
  kind: "movie",
  tmdbId: 25050,
  title: "海角七號",
  originalTitle: null,
  year: 2008,
  region: "台灣",
  posterUrl: "https://image.tmdb.org/t/p/w185/x.jpg",
  credit: "魏德聖",
};

function pending(overrides: Partial<PendingWork> = {}): PendingWork {
  return {
    id: "w1",
    kind: "movie",
    title: "海角七號",
    year: null,
    original_title: null,
    poster_url: null,
    region: null,
    credit: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<EnrichDeps> = {}) {
  const deps = {
    listPending: vi.fn().mockResolvedValue([pending()]),
    search: vi.fn().mockResolvedValue([result("海角七號", 25050), result("海角七號 番外", 9)]),
    detail: vi.fn().mockResolvedValue(CAPE_NO_7),
    findExisting: vi.fn().mockResolvedValue(null),
    applyPatch: vi.fn().mockResolvedValue(undefined),
    markStatus: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn().mockResolvedValue({}),
    log: vi.fn(),
    ...overrides,
  };
  return deps;
}

describe("decideMatch", () => {
  it("唯一結果 → match（即使標題不同）", () => {
    expect(decideMatch("海角7號", [result("海角七號", 1)])).toEqual({ type: "match", result: result("海角七號", 1) });
  });
  it("多筆且第一筆標題相同（含原文片名、忽略大小寫與標點空白）→ match", () => {
    expect(decideMatch("海角七號", [result("海角七號", 1), result("海", 2)]).type).toBe("match");
    expect(decideMatch("the matrix", [result("駭客任務", 3, "The Matrix"), result("x", 4)]).type).toBe("match");
  });
  it("多筆且第一筆不同 → ambiguous（不猜）；第二筆相同也不採用", () => {
    expect(decideMatch("海", [result("海街日記", 1), result("海", 2)])).toEqual({ type: "ambiguous", count: 2 });
  });
  it("零筆 → not_found", () => {
    expect(decideMatch("asdf", [])).toEqual({ type: "not_found" });
  });
  it("normalizeTitle：全形、標點、空白", () => {
    expect(normalizeTitle(" Ｔｈｅ  Matrix： Reloaded ")).toBe("thematrixreloaded");
  });
});

describe("buildPatch", () => {
  it("只補空欄，不覆蓋使用者手填的資料", () => {
    expect(buildPatch(pending({ credit: "手填導演" }), CAPE_NO_7)).toEqual({
      tmdb_id: 25050,
      year: 2008,
      poster_url: CAPE_NO_7.posterUrl,
      region: "台灣",
    });
  });
});

describe("runEnrichBatch", () => {
  it("第一筆標題相同 → 搜尋帶年份、回填、寫 log", async () => {
    const deps = makeDeps({ listPending: vi.fn().mockResolvedValue([pending({ year: 2008 })]) });
    const summary = await runEnrichBatch(deps);
    expect(deps.listPending).toHaveBeenCalledWith(5);
    expect(deps.search).toHaveBeenCalledWith("movie", "海角七號", 2008);
    expect(deps.applyPatch).toHaveBeenCalledWith("w1", expect.objectContaining({ tmdb_id: 25050, credit: "魏德聖" }));
    expect(summary).toMatchObject({ scanned: 1, done: 1 });
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("done"));
  });

  it("模糊 → 標 ambiguous、不打詳情", async () => {
    const deps = makeDeps({
      listPending: vi.fn().mockResolvedValue([pending({ title: "海" })]),
      search: vi.fn().mockResolvedValue([result("海街日記", 1), result("海", 2)]),
    });
    const summary = await runEnrichBatch(deps);
    expect(deps.markStatus).toHaveBeenCalledWith("w1", "ambiguous");
    expect(deps.detail).not.toHaveBeenCalled();
    expect(summary.ambiguous).toBe(1);
  });

  it("查無 → not_found", async () => {
    const deps = makeDeps({ search: vi.fn().mockResolvedValue([]) });
    expect((await runEnrichBatch(deps)).notFound).toBe(1);
    expect(deps.markStatus).toHaveBeenCalledWith("w1", "not_found");
  });

  it("已有同 (kind, tmdb_id) 作品 → duplicate + notify，不回填", async () => {
    const deps = makeDeps({ findExisting: vi.fn().mockResolvedValue("w-existing") });
    const summary = await runEnrichBatch(deps);
    expect(deps.applyPatch).not.toHaveBeenCalled();
    expect(deps.markStatus).toHaveBeenCalledWith("w1", "duplicate");
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("既有作品"), expect.stringContaining("w-existing"));
    expect(summary.duplicate).toBe(1);
  });

  it("回填時撞唯一索引（競態）→ duplicate + notify", async () => {
    const deps = makeDeps({ applyPatch: vi.fn().mockRejectedValue(new UniqueViolationError("23505")) });
    const summary = await runEnrichBatch(deps);
    expect(deps.markStatus).toHaveBeenCalledWith("w1", "duplicate");
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.any(String), expect.any(String));
    expect(summary.duplicate).toBe(1);
  });

  it("TMDB 搜尋失敗 → notify、不標狀態（下一輪重試）、繼續下一筆", async () => {
    const deps = makeDeps({
      listPending: vi.fn().mockResolvedValue([pending(), pending({ id: "w2" })]),
      search: vi
        .fn()
        .mockRejectedValueOnce(new Error("TMDB 回應 503"))
        .mockResolvedValueOnce([result("海角七號", 25050)]),
    });
    const summary = await runEnrichBatch(deps);
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("TMDB 搜尋失敗"), expect.stringContaining("503"));
    expect(deps.markStatus).not.toHaveBeenCalledWith("w1", expect.anything());
    expect(summary).toMatchObject({ scanned: 2, failed: 1, done: 1 });
  });

  it("TMDB 詳情失敗 → notify、failed", async () => {
    const deps = makeDeps({ detail: vi.fn().mockRejectedValue(new Error("timeout")) });
    expect((await runEnrichBatch(deps)).failed).toBe(1);
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("詳情失敗"), expect.any(String));
    expect(deps.applyPatch).not.toHaveBeenCalled();
  });

  it("DB 寫回一般錯誤 → notify error、繼續", async () => {
    const deps = makeDeps({ applyPatch: vi.fn().mockRejectedValue(new Error("db down")) });
    expect((await runEnrichBatch(deps)).failed).toBe(1);
    expect(deps.notify).toHaveBeenCalledWith("error", expect.stringContaining("寫回"), expect.stringContaining("db down"));
  });

  it("讀取待補清單失敗 → notify error、回空摘要", async () => {
    const deps = makeDeps({ listPending: vi.fn().mockRejectedValue(new Error("conn refused")) });
    expect(await runEnrichBatch(deps)).toEqual({ scanned: 0, done: 0, ambiguous: 0, notFound: 0, duplicate: 0, failed: 0 });
    expect(deps.notify).toHaveBeenCalledWith("error", expect.any(String), "conn refused");
  });
});
