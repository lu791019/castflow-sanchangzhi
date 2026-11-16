import { describe, expect, it, vi } from "vitest";
import { ItunesError } from "@/lib/work-picker/itunes";
import { appleMusicTopUrlFromEnv, APPLE_MUSIC_TOP_URL, loadTrendingAlbums, parseAppleMusicTop } from "./apple-music-top";

const feed = {
  feed: {
    title: "熱門專輯",
    results: [
      {
        artistName: "田馥甄",
        id: "6812635395",
        name: "要去什麼地方",
        releaseDate: "2026-09-24",
        kind: "albums",
        artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cover.jpg/100x100bb.jpg",
        url: "https://music.apple.com/tw/album/x/6812635395",
      },
      { artistName: "NCT WISH", id: "1800000001", name: "I SPY - The 4th Mini Album - EP", kind: "albums", releaseDate: "2026-10-01" },
      { id: "not-a-number", name: "壞資料" },
      { id: "1800000002", name: " " },
    ],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Apple Music 台灣熱門專輯榜", () => {
  it("榜單 JSON → 專輯列（依名次；id 超過 integer 也照收；封面換 600；EP 字尾拿掉）", () => {
    expect(parseAppleMusicTop(feed)).toEqual([
      {
        kind: "music",
        itunesId: 6812635395,
        title: "要去什麼地方",
        artist: "田馥甄",
        year: 2026,
        trackCount: null,
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cover.jpg/600x600bb.jpg",
        feelingCount: 0,
      },
      expect.objectContaining({ itunesId: 1800000001, title: "I SPY - The 4th Mini Album", artist: "NCT WISH", artworkUrl: null }),
    ]);
    expect(parseAppleMusicTop(null)).toEqual([]);
  });

  it("預設打官方榜（most-played 25 albums）；非 production 可用 APPLE_MUSIC_TOP_URL 指到假榜", async () => {
    expect(APPLE_MUSIC_TOP_URL).toBe("https://rss.marketingtools.apple.com/api/v2/tw/music/most-played/25/albums.json");
    const fetchMock = vi.fn(async () => jsonResponse(feed));
    const albums = await loadTrendingAlbums({ fetch: fetchMock });
    expect(albums).toHaveLength(2);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(APPLE_MUSIC_TOP_URL);
    expect(appleMusicTopUrlFromEnv({ NODE_ENV: "development", APPLE_MUSIC_TOP_URL: "http://127.0.0.1:1/top" })).toBe("http://127.0.0.1:1/top");
    expect(appleMusicTopUrlFromEnv({ NODE_ENV: "production", APPLE_MUSIC_TOP_URL: "http://127.0.0.1:1/top" })).toBeUndefined();
  });

  it("榜單空的或上游失敗 → ItunesError（由快取層決定用舊資料並警報）", async () => {
    await expect(loadTrendingAlbums({ fetch: vi.fn(async () => jsonResponse({ feed: { results: [] } })) })).rejects.toBeInstanceOf(ItunesError);
    await expect(loadTrendingAlbums({ fetch: vi.fn(async () => jsonResponse({}, 500)) })).rejects.toBeInstanceOf(ItunesError);
  });
});
