import { describe, expect, it, vi } from "vitest";
import { createStaleCache } from "./stale-cache";

describe("createStaleCache：TTL 內直接回、過期重抓、失敗回舊值並通知", () => {
  it("第一次載入；TTL 內不再打上游", async () => {
    let clock = 0;
    const load = vi.fn(async () => "a");
    const cache = createStaleCache({ ttlMs: 100, load, onStale: vi.fn(), now: () => clock });
    expect(await cache.get()).toBe("a");
    clock = 99;
    expect(await cache.get()).toBe("a");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("過期重抓成功換新值；重抓失敗回舊值並回報年齡", async () => {
    let clock = 0;
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error("上游掛了");
      return `v${clock}`;
    });
    const onStale = vi.fn();
    const cache = createStaleCache({ ttlMs: 100, load, onStale, now: () => clock });
    await cache.get();
    clock = 150;
    expect(await cache.get()).toBe("v150");
    clock = 300;
    fail = true;
    expect(await cache.get()).toBe("v150");
    expect(onStale).toHaveBeenCalledWith(expect.any(Error), 150);
  });

  it("第一次就失敗、沒有舊值 → 直接丟錯", async () => {
    const cache = createStaleCache({ ttlMs: 100, load: async () => { throw new Error("no"); }, onStale: vi.fn() });
    await expect(cache.get()).rejects.toThrow("no");
  });

  it("並發只打一次上游", async () => {
    const load = vi.fn(async () => "x");
    const cache = createStaleCache({ ttlMs: 100, load, onStale: vi.fn() });
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
