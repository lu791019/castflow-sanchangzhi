import { describe, expect, it, vi } from "vitest";
import type { PodcastShowResult } from "./types";
import { ItunesError, createTtlCache, normalizePodcast, searchPodcasts } from "./itunes";

const raw = {
  collectionId: 1500839292,
  collectionName: "股癌 Gooaye",
  artistName: "謝孟恭",
  trackCount: 703,
  artworkUrl600: "https://is1.example/600x600bb.jpg",
  artworkUrl100: "https://is1.example/100x100bb.jpg",
  feedUrl: "https://feeds.soundon.fm/podcasts/x.xml",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("normalizePodcast", () => {
  it("取 id/名稱/作者/集數/封面/feedUrl；封面用 600", () => {
    expect(normalizePodcast(raw)).toEqual({
      kind: "podcast",
      itunesId: 1500839292,
      name: "股癌 Gooaye",
      artist: "謝孟恭",
      trackCount: 703,
      artworkUrl: "https://is1.example/600x600bb.jpg",
      feedUrl: "https://feeds.soundon.fm/podcasts/x.xml",
    });
  });
  it("沒 feedUrl 的節目不能選集數 → 丟掉；沒 600 退回 100", () => {
    expect(normalizePodcast({ ...raw, feedUrl: undefined })).toBeNull();
    expect(normalizePodcast({ ...raw, artworkUrl600: undefined })?.artworkUrl).toBe(raw.artworkUrl100);
  });
});

describe("createTtlCache", () => {
  it("TTL 內命中，過期失效", () => {
    let now = 1_000;
    const cache = createTtlCache<string>(10_000, () => now);
    cache.set("a", "x");
    expect(cache.get("a")).toBe("x");
    now = 11_001;
    expect(cache.get("a")).toBeUndefined();
  });
  it("容量上限：超過時淘汰最舊", () => {
    const cache = createTtlCache<number>(10_000, () => 0, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });
});

describe("searchPodcasts", () => {
  it("組 media=podcast&country=tw 的 URL，回正規化列（最多 20）", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [raw, { collectionId: 2 }] }));
    const results = await searchPodcasts("股癌", { fetch: fetchMock, cache: createTtlCache(1000) });
    expect(results).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("media=podcast");
    expect(url).toContain("country=tw");
    expect(url).toContain(`term=${encodeURIComponent("股癌")}`);
  });
  it("同 term 第二次走快取不再打 API（限速 20 次/分）", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [raw] }));
    const cache = createTtlCache<PodcastShowResult[]>(60_000);
    await searchPodcasts("股癌", { fetch: fetchMock, cache });
    await searchPodcasts("股癌 ", { fetch: fetchMock, cache });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("非 2xx → ItunesError 帶狀態碼", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 403));
    await expect(
      searchPodcasts("股癌", { fetch: fetchMock, cache: createTtlCache(1000) }),
    ).rejects.toBeInstanceOf(ItunesError);
  });
});
