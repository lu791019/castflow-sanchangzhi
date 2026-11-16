import { describe, expect, it, vi } from "vitest";
import { SpotifyApiError } from "@/lib/spotify/api";
import type { SpotifyAlbumCandidate, SpotifyShowCandidate } from "@/lib/spotify/match";
import { autoLinkSpotify, planSpotifyAutoLink, type AutoLinkDeps, type AutoLinkWork } from "./spotify-auto";

const ALBUM_ID = "6wlO3VClebIlgMCfBcFbUy";
const SHOW_ID = "1zWxx5pKk0XBEzMupVC7UZ";

const MUSIC: AutoLinkWork = { id: "w1", kind: "music", title: "帶你飛", credit: "告五人", podcast_show: null, feed_url: null, trackCount: 10 };
const PODCAST: AutoLinkWork = {
  id: "w2",
  kind: "podcast_episode",
  title: "EP500 | 盤勢",
  credit: "謝孟恭",
  podcast_show: "Gooaye 股癌",
  feed_url: "https://feeds.example.com/gooaye.xml",
};

const albumHit: SpotifyAlbumCandidate = { id: ALBUM_ID, name: "帶你飛", album_type: "album", total_tracks: 10, artists: ["告五人"] };
const showHit: SpotifyShowCandidate = { id: SHOW_ID, name: "Gooaye 股癌", publisher: null, description: null };

function makeDeps(overrides: Partial<AutoLinkDeps> = {}): AutoLinkDeps {
  return {
    hasSpotifyLink: vi.fn(async () => false),
    findFeedShowUrl: vi.fn(async () => null),
    searchAlbums: vi.fn(async () => [albumHit]),
    searchShows: vi.fn(async () => [showHit]),
    saveAutoLink: vi.fn(async () => true),
    warn: vi.fn(),
    ...overrides,
  };
}

describe("autoLinkSpotify", () => {
  it("音樂：有把握的專輯 → 寫正規化網址（同 A①格式）", async () => {
    const deps = makeDeps();
    const outcome = await autoLinkSpotify(MUSIC, deps);
    expect(outcome).toMatchObject({ status: "linked", url: `https://open.spotify.com/album/${ALBUM_ID}`, via: "search" });
    expect(deps.searchAlbums).toHaveBeenCalledWith("帶你飛 告五人");
    expect(deps.saveAutoLink).toHaveBeenCalledWith("w1", `https://open.spotify.com/album/${ALBUM_ID}`);
  });

  it("Podcast：節目名稱搜尋 → show 直連", async () => {
    const deps = makeDeps();
    expect(await autoLinkSpotify(PODCAST, deps)).toMatchObject({ status: "linked", url: `https://open.spotify.com/show/${SHOW_ID}` });
    expect(deps.searchShows).toHaveBeenCalledWith("Gooaye 股癌");
  });

  it("Podcast：同節目別集已有 show 直連 → 沿用，不打 Spotify", async () => {
    const deps = makeDeps({ findFeedShowUrl: vi.fn(async () => `https://open.spotify.com/show/${SHOW_ID}`) });
    expect(await autoLinkSpotify(PODCAST, deps)).toMatchObject({ status: "linked", via: "same_feed" });
    expect(deps.findFeedShowUrl).toHaveBeenCalledWith(PODCAST.feed_url, "w2");
    expect(deps.searchShows).not.toHaveBeenCalled();
  });

  it("Podcast：同節目別集是單集連結 → 不沿用，照常搜", async () => {
    const deps = makeDeps({ findFeedShowUrl: vi.fn(async () => `https://open.spotify.com/episode/${SHOW_ID}`) });
    expect(await autoLinkSpotify(PODCAST, deps)).toMatchObject({ status: "linked", via: "search" });
    expect(deps.searchShows).toHaveBeenCalled();
  });

  it("已有 Spotify 連結（讀者貼的）→ 不搜、不寫", async () => {
    const deps = makeDeps({ hasSpotifyLink: vi.fn(async () => true) });
    expect(await autoLinkSpotify(MUSIC, deps)).toEqual({ status: "exists" });
    expect(deps.searchAlbums).not.toHaveBeenCalled();
    expect(deps.saveAutoLink).not.toHaveBeenCalled();
  });

  it("寫入時讀者剛好先貼（insert-if-absent 沒寫進去）→ exists，不覆蓋", async () => {
    const deps = makeDeps({ saveAutoLink: vi.fn(async () => false) });
    expect(await autoLinkSpotify(MUSIC, deps)).toEqual({ status: "exists" });
  });

  it("沒把握 → no_match，不寫（保留搜尋連結）", async () => {
    const deps = makeDeps({ searchAlbums: vi.fn(async () => [{ ...albumHit, artists: ["別人"] }]) });
    expect(await autoLinkSpotify(MUSIC, deps)).toEqual({ status: "no_match", candidates: 1 });
    expect(deps.saveAutoLink).not.toHaveBeenCalled();
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it("電影、演出等 → skipped，不碰 DB", async () => {
    const deps = makeDeps();
    expect(await autoLinkSpotify({ ...MUSIC, kind: "movie" }, deps)).toEqual({ status: "skipped", reason: "unsupported_kind" });
    expect(deps.hasSpotifyLink).not.toHaveBeenCalled();
  });

  it("沒有藝人或節目名 → skipped no_query", async () => {
    expect(await autoLinkSpotify({ ...MUSIC, credit: null }, makeDeps())).toEqual({ status: "skipped", reason: "no_query" });
    expect(await autoLinkSpotify({ ...PODCAST, podcast_show: " " }, makeDeps())).toEqual({ status: "skipped", reason: "no_query" });
  });

  it("429 配額用完 → 不丟例外、回 failed、推警報（標題寫明 QUOTA_EXCEEDED）", async () => {
    const quota = new SpotifyApiError("Spotify 搜尋失敗：HTTP 429（QUOTA_EXCEEDED）", { status: 429, rateLimited: true, quotaExceeded: true });
    const deps = makeDeps({ searchAlbums: vi.fn(async () => Promise.reject(quota)) });
    const outcome = await autoLinkSpotify(MUSIC, deps);
    expect(outcome).toMatchObject({ status: "failed" });
    expect(deps.warn).toHaveBeenCalledWith(expect.stringContaining("QUOTA_EXCEEDED"), expect.stringContaining("work=w1"));
    expect(deps.saveAutoLink).not.toHaveBeenCalled();
  });

  it("冷卻中略過 → failed 但不重推警報（進冷卻那次推過了）", async () => {
    const cooling = new SpotifyApiError("Spotify 配額冷卻中", { status: 429, rateLimited: true, cooling: true });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const deps = makeDeps({ searchAlbums: vi.fn(async () => Promise.reject(cooling)) });
    expect(await autoLinkSpotify(MUSIC, deps)).toMatchObject({ status: "failed" });
    expect(deps.warn).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("DB 讀寫失敗 → failed＋警報，不丟例外", async () => {
    const deps = makeDeps({ saveAutoLink: vi.fn(async () => Promise.reject(new Error("db down"))) });
    expect(await autoLinkSpotify(MUSIC, deps)).toEqual({ status: "failed", error: "db down" });
    expect(deps.warn).toHaveBeenCalledWith(expect.stringContaining("自動直連失敗"), expect.stringContaining("db down"));
  });
});

describe("planSpotifyAutoLink（乾跑用，只比對不寫）", () => {
  it("回比對結果與 Spotify 上的名稱", async () => {
    const deps = makeDeps();
    expect(await planSpotifyAutoLink(MUSIC, deps)).toEqual({
      status: "match",
      url: `https://open.spotify.com/album/${ALBUM_ID}`,
      via: "search",
      name: "帶你飛 — 告五人",
    });
  });
});
