import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit/token-bucket";
import { createTtlCache, ItunesError } from "./itunes";
import {
  albumArtwork,
  cleanAlbumTitle,
  itunesMusicUrlsFromEnv,
  lookupAlbum,
  normalizeAlbum,
  searchAlbums,
} from "./itunes-music";
import type { MusicAlbumResult } from "./types";

const raw = {
  wrapperType: "collection",
  collectionType: "Album",
  collectionId: 1670343367,
  artistName: "告五人",
  collectionName: "帶你飛",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e7/x/4710616566147.jpg/100x100bb.jpg",
  trackCount: 10,
  releaseDate: "2023-02-14T08:00:00Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("專輯正規化", () => {
  it("取 collectionId／專輯名／歌手／發行年／曲數；封面換成 600 大圖", () => {
    expect(normalizeAlbum(raw)).toEqual({
      kind: "music",
      itunesId: 1670343367,
      title: "帶你飛",
      artist: "告五人",
      year: 2023,
      trackCount: 10,
      artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e7/x/4710616566147.jpg/600x600bb.jpg",
      feelingCount: 0,
    });
  });

  it("單曲、EP 的「 - Single」「 - EP」字尾拿掉", () => {
    expect(cleanAlbumTitle("披星戴月的想你 - Single")).toBe("披星戴月的想你");
    expect(cleanAlbumTitle("I SPY - The 4th Mini Album - EP")).toBe("I SPY - The 4th Mini Album");
    expect(cleanAlbumTitle("帶你飛")).toBe("帶你飛");
  });

  it("不是專輯（歌曲、藝人）或缺 id／名稱 → 丟掉", () => {
    expect(normalizeAlbum({ ...raw, wrapperType: "track" })).toBeNull();
    expect(normalizeAlbum({ ...raw, collectionId: "x" })).toBeNull();
    expect(normalizeAlbum({ ...raw, collectionName: " " })).toBeNull();
  });

  it("封面：只收 http(s)；不是 mzstatic 的尺寸格式就照原網址", () => {
    expect(albumArtwork("https://a.example/cover.jpg")).toBe("https://a.example/cover.jpg");
    expect(albumArtwork("javascript:alert(1)")).toBeNull();
    expect(albumArtwork(undefined)).toBeNull();
  });
});

describe("searchAlbums", () => {
  it("entity=album&country=tw，回正規化列", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [raw, { wrapperType: "artist" }] }));
    const results = await searchAlbums("告五人", { fetch: fetchMock, cache: createTtlCache(1000) });
    expect(results.map((item) => item.title)).toEqual(["帶你飛"]);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("https://itunes.apple.com/search?");
    expect(url).toContain("entity=album");
    expect(url).toContain("country=tw");
    expect(url).toContain(`term=${encodeURIComponent("告五人")}`);
  });

  it("同 term 走快取；快取未命中才扣全域限流，超過丟 429 不打上游", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [raw] }));
    const cache = createTtlCache<MusicAlbumResult[]>(60_000);
    const limiter = createRateLimiter({ capacity: 1, windowMs: 60_000 });
    await searchAlbums("告五人", { fetch: fetchMock, cache, limiter });
    await searchAlbums("告五人 ", { fetch: fetchMock, cache, limiter });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(searchAlbums("田馥甄", { fetch: fetchMock, cache, limiter })).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("可指到假 iTunes（E2E）；非 2xx → ItunesError", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 503));
    await expect(
      searchAlbums("告五人", { fetch: fetchMock, cache: createTtlCache(1000), searchUrl: "http://127.0.0.1:1/search" }),
    ).rejects.toBeInstanceOf(ItunesError);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url.startsWith("http://127.0.0.1:1/search?")).toBe(true);
  });
});

describe("lookupAlbum", () => {
  it("lookup?id= 取回同一張；查無回 null（也快取）", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [raw] }));
    const cache = createTtlCache<MusicAlbumResult | null>(60_000);
    expect((await lookupAlbum(1670343367, { fetch: fetchMock, cache }))?.title).toBe("帶你飛");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("id=1670343367");
    expect(url).toContain("entity=album");

    const empty = vi.fn(async () => jsonResponse({ results: [] }));
    expect(await lookupAlbum(42, { fetch: empty, cache })).toBeNull();
    expect(await lookupAlbum(42, { fetch: empty, cache })).toBeNull();
    expect(empty).toHaveBeenCalledTimes(1);
  });
});

describe("itunesMusicUrlsFromEnv", () => {
  it("非 production 才吃 ITUNES_SEARCH_URL／ITUNES_LOOKUP_URL", () => {
    const env = { ITUNES_SEARCH_URL: "http://127.0.0.1:3167/itunes/search", ITUNES_LOOKUP_URL: "http://127.0.0.1:3167/itunes/lookup" };
    expect(itunesMusicUrlsFromEnv({ ...env, NODE_ENV: "development" })).toEqual({
      searchUrl: env.ITUNES_SEARCH_URL,
      lookupUrl: env.ITUNES_LOOKUP_URL,
    });
    expect(itunesMusicUrlsFromEnv({ ...env, NODE_ENV: "production" })).toEqual({});
  });
});
