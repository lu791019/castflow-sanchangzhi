import { describe, expect, it, vi } from "vitest";
import { contentHash } from "./text";
import {
  planEmbedding,
  refreshEmbeddings,
  syncEpisodeEmbedding,
  REFRESH_LIMIT,
  type EmbeddingSource,
  type EmbeddingStore,
} from "./sync";
import { VOYAGE_MODEL, type Embedder } from "./voyage";
import { createOnceWarner } from "./config";

const TEXT = "走出戲院那晚\n\n第一段。";

function source(overrides: Partial<EmbeddingSource> = {}): EmbeddingSource {
  return { episodeId: "ep1", eligible: true, text: TEXT, storedHash: null, ...overrides };
}

function fakeStore(sources: EmbeddingSource[]): EmbeddingStore & {
  upserted: Array<{ episodeId: string; hash: string }>;
  removed: string[];
  checked: string[][];
} {
  const upserted: Array<{ episodeId: string; hash: string }> = [];
  const removed: string[] = [];
  const checked: string[][] = [];
  return {
    upserted,
    removed,
    checked,
    loadSource: async (id) => sources.find((item) => item.episodeId === id) ?? null,
    loadQueue: async () => sources,
    upsert: async (row) => {
      upserted.push({ episodeId: row.episodeId, hash: row.contentHash });
    },
    remove: async (id) => {
      removed.push(id);
    },
    markChecked: async (ids) => {
      checked.push([...ids]);
    },
  };
}

function fakeEmbedder(): Embedder & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    model: VOYAGE_MODEL,
    calls,
    embed: async (texts) => {
      calls.push([...texts]);
      return texts.map(() => [0.1, 0.2]);
    },
  };
}

describe("planEmbedding", () => {
  it("沒算過 → embed", () => {
    expect(planEmbedding(source(), VOYAGE_MODEL)).toEqual({ action: "embed", hash: contentHash(VOYAGE_MODEL, TEXT) });
  });

  it("hash 相同 → 跳過", () => {
    expect(planEmbedding(source({ storedHash: contentHash(VOYAGE_MODEL, TEXT) }), VOYAGE_MODEL)).toEqual({
      action: "unchanged",
    });
  });

  it("內文改過（hash 過期）→ embed", () => {
    expect(planEmbedding(source({ storedHash: "old" }), VOYAGE_MODEL).action).toBe("embed");
  });

  it("不再公開／匿名 → 有舊列就刪，沒有就略過", () => {
    expect(planEmbedding(source({ eligible: false, storedHash: "old" }), VOYAGE_MODEL)).toEqual({ action: "delete" });
    expect(planEmbedding(source({ eligible: false }), VOYAGE_MODEL)).toEqual({ action: "ignore" });
  });

  it("沒有文字 → 當成不算", () => {
    expect(planEmbedding(source({ text: "", storedHash: "old" }), VOYAGE_MODEL)).toEqual({ action: "delete" });
  });
});

describe("syncEpisodeEmbedding", () => {
  it("公開筆名文章 → 算並寫入", async () => {
    const store = fakeStore([source()]);
    const embedder = fakeEmbedder();
    await expect(syncEpisodeEmbedding({ store, embedder, onMissingKey: vi.fn() }, "ep1")).resolves.toBe("embedded");
    expect(embedder.calls).toEqual([[TEXT]]);
    expect(store.upserted).toEqual([{ episodeId: "ep1", hash: contentHash(VOYAGE_MODEL, TEXT) }]);
  });

  it("改成不公開 → 刪該列，不打 API", async () => {
    const store = fakeStore([source({ eligible: false, storedHash: "old" })]);
    const embedder = fakeEmbedder();
    await expect(syncEpisodeEmbedding({ store, embedder, onMissingKey: vi.fn() }, "ep1")).resolves.toBe("deleted");
    expect(store.removed).toEqual(["ep1"]);
    expect(embedder.calls).toEqual([]);
  });

  it("沒有 key → 不丟錯、通知一次、略過", async () => {
    const store = fakeStore([source()]);
    const onMissingKey = vi.fn();
    await expect(syncEpisodeEmbedding({ store, embedder: null, onMissingKey }, "ep1")).resolves.toBe("no_key");
    expect(onMissingKey).toHaveBeenCalledTimes(1);
    expect(store.upserted).toEqual([]);
  });

  it("找不到文章 → 略過", async () => {
    await expect(
      syncEpisodeEmbedding({ store: fakeStore([]), embedder: fakeEmbedder(), onMissingKey: vi.fn() }, "nope"),
    ).resolves.toBe("ignored");
  });
});

describe("refreshEmbeddings", () => {
  it("只挑沒算過或 hash 過期的，最多 REFRESH_LIMIT 篇；沒變的標 checked", async () => {
    const fresh = contentHash(VOYAGE_MODEL, TEXT);
    const queue = [
      source({ episodeId: "same", storedHash: fresh }),
      ...Array.from({ length: REFRESH_LIMIT + 2 }, (_, i) => source({ episodeId: `new${i}` })),
    ];
    const store = fakeStore(queue);
    const embedder = fakeEmbedder();
    const result = await refreshEmbeddings({ store, embedder, onMissingKey: vi.fn() });
    expect(result).toEqual({ scanned: REFRESH_LIMIT, embedded: REFRESH_LIMIT, skipped: 0, failed: 0, errors: [] });
    expect(embedder.calls).toHaveLength(1);
    expect(embedder.calls[0]).toHaveLength(REFRESH_LIMIT);
    expect(store.checked).toEqual([["same"]]);
  });

  it("沒有 key → scanned 照算、全部 skipped、通知一次", async () => {
    const store = fakeStore([source({ episodeId: "a" }), source({ episodeId: "b" })]);
    const onMissingKey = vi.fn();
    const result = await refreshEmbeddings({ store, embedder: null, onMissingKey });
    expect(result).toEqual({ scanned: 2, embedded: 0, skipped: 2, failed: 0, errors: [] });
    expect(onMissingKey).toHaveBeenCalledTimes(1);
  });

  it("沒有要算的 → 不通知也不打 API", async () => {
    const onMissingKey = vi.fn();
    const result = await refreshEmbeddings({ store: fakeStore([]), embedder: null, onMissingKey });
    expect(result.scanned).toBe(0);
    expect(onMissingKey).not.toHaveBeenCalled();
  });

  it("Voyage 失敗 → 全部算 failed，回傳錯誤訊息，不擲錯", async () => {
    const store = fakeStore([source({ episodeId: "a" })]);
    const embedder: Embedder = { model: VOYAGE_MODEL, embed: async () => Promise.reject(new Error("Voyage 503")) };
    const result = await refreshEmbeddings({ store, embedder, onMissingKey: vi.fn() });
    expect(result).toEqual({ scanned: 1, embedded: 0, skipped: 0, failed: 1, errors: ["Voyage 503"] });
    expect(store.upserted).toEqual([]);
  });
});

describe("createOnceWarner", () => {
  it("只通知一次", () => {
    const warn = vi.fn();
    const once = createOnceWarner(warn);
    once();
    once();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
