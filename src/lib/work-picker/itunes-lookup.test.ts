import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit/token-bucket";
import { createTtlCache, ItunesError, lookupPodcastArtwork } from "./itunes";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deps(fetchImpl: typeof fetch) {
  return { fetch: fetchImpl, cache: createTtlCache<string | null>(60_000) };
}

describe("lookupPodcastArtwork", () => {
  it("lookup id → artworkUrl600（帶 entity=podcast、country=tw）", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ resultCount: 1, results: [{ collectionId: 42, artworkUrl600: "https://is1/600.jpg", artworkUrl100: "https://is1/100.jpg" }] }),
    );
    await expect(lookupPodcastArtwork(42, deps(fetchMock as unknown as typeof fetch))).resolves.toBe("https://is1/600.jpg");
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/lookup");
    expect(url.searchParams.get("id")).toBe("42");
    expect(url.searchParams.get("entity")).toBe("podcast");
  });

  it("沒有 600 用 100；查無結果回 null", async () => {
    const only100 = vi.fn(async () => jsonResponse({ results: [{ collectionId: 7, artworkUrl100: "https://is1/100.jpg" }] }));
    await expect(lookupPodcastArtwork(7, deps(only100 as unknown as typeof fetch))).resolves.toBe("https://is1/100.jpg");
    const empty = vi.fn(async () => jsonResponse({ resultCount: 0, results: [] }));
    await expect(lookupPodcastArtwork(8, deps(empty as unknown as typeof fetch))).resolves.toBeNull();
  });

  it("同一個 id 走快取（含查無的 null）", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    const shared = deps(fetchMock as unknown as typeof fetch);
    await lookupPodcastArtwork(9, shared);
    await lookupPodcastArtwork(9, shared);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("上游非 200 丟 ItunesError；全域限流用完丟 429 不打上游", async () => {
    const bad = vi.fn(async () => jsonResponse({}, 503));
    await expect(lookupPodcastArtwork(1, deps(bad as unknown as typeof fetch))).rejects.toBeInstanceOf(ItunesError);
    const never = vi.fn();
    const limiter = createRateLimiter({ capacity: 1, windowMs: 60_000 });
    limiter.take("itunes");
    await expect(
      lookupPodcastArtwork(2, { ...deps(never as unknown as typeof fetch), limiter }),
    ).rejects.toMatchObject({ status: 429 });
    expect(never).not.toHaveBeenCalled();
  });
});
