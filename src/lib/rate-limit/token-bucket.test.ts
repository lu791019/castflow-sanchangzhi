import { describe, expect, it, vi } from "vitest";
import { createTtlCache, searchPodcasts, type ItunesDeps, isItunesRateLimited, ItunesError } from "@/lib/work-picker/itunes";
import { clientIp, createRateLimiter } from "./token-bucket";

describe("createRateLimiter", () => {
  it("每分鐘 30 次：慢速連打（每次隔 500ms）第 31 次仍被拒，並給 retryAfter", () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 30, windowMs: 60_000, now: () => now });
    const results = Array.from({ length: 31 }, () => {
      const result = limiter.take("1.1.1.1");
      now += 500;
      return result;
    });
    expect(results.slice(0, 30).every((r) => r.allowed)).toBe(true);
    expect(results[30]).toEqual({ allowed: false, retryAfterMs: 60_000 - 15_000, remaining: 0 });
    // 別的 IP 不受影響
    expect(limiter.take("2.2.2.2").allowed).toBe(true);
    // 視窗結束前仍拒、結束後補滿
    now = 59_999;
    expect(limiter.take("1.1.1.1").allowed).toBe(false);
    now = 60_000;
    expect(limiter.take("1.1.1.1")).toMatchObject({ allowed: true, remaining: 29 });
  });

  it("一分鐘後補滿", () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 3, windowMs: 60_000, now: () => now });
    [1, 2, 3].forEach(() => limiter.take("k"));
    expect(limiter.peek("k")).toBe(0);
    now = 60_000;
    expect(limiter.peek("k")).toBe(3);
  });

  it("key 數超過上限時清掉已補滿的桶，維持上限", () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 1, windowMs: 1_000, now: () => now, maxKeys: 2 });
    limiter.take("a");
    limiter.take("b");
    now = 5_000;
    expect(limiter.take("c").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
  });

  it("參數非正數 → 丟錯", () => {
    expect(() => createRateLimiter({ capacity: 0, windowMs: 1 })).toThrow();
  });
});

describe("clientIp", () => {
  it("x-forwarded-for 取第一個 → x-real-ip → unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("iTunes 全域限流", () => {
  function deps(fetchFn: ReturnType<typeof vi.fn>, capacity: number): ItunesDeps {
    return {
      fetch: fetchFn as unknown as typeof fetch,
      cache: createTtlCache(60_000),
      limiter: createRateLimiter({ capacity, windowMs: 60_000, now: () => 0 }),
    };
  }
  const ok = () => new Response(JSON.stringify({ results: [] }), { status: 200 });

  it("超過上限：快取命中照回，未命中丟 429 且不打上游", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => ok());
    const d = deps(fetchFn, 1);
    await expect(searchPodcasts("百靈果", d)).resolves.toEqual([]);
    await expect(searchPodcasts("百靈果", d)).resolves.toEqual([]);
    const error = await searchPodcasts("股癌", d).catch((e: unknown) => e);
    expect(isItunesRateLimited(error)).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("isItunesRateLimited 只認 429 的 ItunesError", () => {
    expect(isItunesRateLimited(new ItunesError("x", 500))).toBe(false);
    expect(isItunesRateLimited(new Error("x"))).toBe(false);
  });
});
