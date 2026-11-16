import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "./ttl-cache";

describe("createTtlCache", () => {
  it("TTL 內同一個 key 只打一次上游；並發共用同一個 promise", async () => {
    let now = 0;
    const load = vi.fn(async (key: string) => `v:${key}`);
    const cache = createTtlCache({ ttlMs: 1000, maxEntries: 10, now: () => now });
    const [a, b] = await Promise.all([cache.get("k", () => load("k")), cache.get("k", () => load("k"))]);
    expect([a, b]).toEqual(["v:k", "v:k"]);
    expect(load).toHaveBeenCalledTimes(1);
    now = 999;
    await cache.get("k", () => load("k"));
    expect(load).toHaveBeenCalledTimes(1);
    now = 1000;
    await cache.get("k", () => load("k"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("失敗不進快取，下次重打", async () => {
    const cache = createTtlCache<string>({ ttlMs: 1000, maxEntries: 10, now: () => 0 });
    await expect(cache.get("k", () => Promise.reject(new Error("逾時")))).rejects.toThrow("逾時");
    await expect(cache.get("k", async () => "好了")).resolves.toBe("好了");
  });

  it("超過上限丟掉最舊的", async () => {
    const cache = createTtlCache<string>({ ttlMs: 1000, maxEntries: 2, now: () => 0 });
    await cache.get("a", async () => "a");
    await cache.get("b", async () => "b");
    await cache.get("c", async () => "c");
    const load = vi.fn(async () => "a2");
    await expect(cache.get("a", load)).resolves.toBe("a2");
    expect(load).toHaveBeenCalledTimes(1);
  });
});
