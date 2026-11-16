import { describe, expect, it } from "vitest";
import type { WatchSnapshot } from "@/lib/watch/providers";
import { CURATED_COUNT } from "./curated";
import { curatedWatchLinks, quickWatchLink, tmdbWatchPage } from "./quick-links";
import { providerSource, snapshotWatchLinks, watchInfoLinks } from "./watch-links";

const NOW = new Date("2026-10-13T04:00:00Z");
const TMDB_LINK = "https://www.themoviedb.org/tv/66732-stranger-things/watch?locale=TW";

describe("curated 映射", () => {
  it("先放 20 部", () => {
    expect(CURATED_COUNT).toBe(20);
  });
  it("tmdbId 對到平台直連頁", () => {
    expect(curatedWatchLinks("series", 66732)).toEqual([
      { kind: "watch", source: "netflix", label: "Netflix", url: "https://www.netflix.com/title/80057281", origin: "curated", note: null },
    ]);
    expect(curatedWatchLinks("movie", 66732)).toEqual([]);
  });
});

describe("providerSource", () => {
  it("TMDB 平台名 → 與白名單一致的來源鍵", () => {
    expect(providerSource("Netflix")).toBe("netflix");
    expect(providerSource("Disney Plus")).toBe("disneyplus");
    expect(providerSource("Amazon Prime Video")).toBe("primevideo");
    expect(providerSource("Catchplay")).toBe("catchplay");
    expect(providerSource("Apple TV Store")).toBe("tmdb:apple-tv-store");
  });
});

describe("snapshotWatchLinks：TMDB 快照 → 按鈕", () => {
  const snapshot: WatchSnapshot = {
    providers: [
      { name: "Netflix", kind: "subscription", link: TMDB_LINK },
      { name: "Apple TV Store", kind: "rent", link: TMDB_LINK },
    ],
    link: TMDB_LINK,
    releaseDate: null,
  };
  it("每個平台一顆，連 TMDB／JustWatch 中介頁，小字標訂閱／租借", () => {
    expect(snapshotWatchLinks(snapshot, NOW)).toEqual([
      { kind: "watch", source: "netflix", label: "Netflix", url: TMDB_LINK, origin: "tmdb", note: "訂閱" },
      { kind: "watch", source: "tmdb:apple-tv-store", label: "Apple TV Store", url: TMDB_LINK, origin: "tmdb", note: "租借" },
    ]);
  });
  it("沒快照、沒平台 → 空", () => {
    expect(snapshotWatchLinks(null, NOW)).toEqual([]);
    expect(snapshotWatchLinks({ providers: [], link: null, releaseDate: "2026-10-01" }, NOW)).toEqual([]);
  });
});

describe("quickWatchLink（本週熱門每列，不打 DB）", () => {
  it("有 curated → 平台直連", () => {
    expect(quickWatchLink({ kind: "series", tmdbId: 66732, title: "怪奇物語", section: "trending" })).toMatchObject({
      label: "Netflix",
      url: "https://www.netflix.com/title/80057281",
    });
  });
  it("沒有 → TMDB 觀看頁（資料來自 JustWatch）", () => {
    expect(quickWatchLink({ kind: "movie", tmdbId: 1, title: "x", section: "upcoming" })).toEqual({
      kind: "watch",
      source: "tmdb",
      label: "在哪看",
      url: tmdbWatchPage("movie", 1),
      origin: "tmdb",
      note: null,
    });
    expect(tmdbWatchPage("series", 9)).toBe("https://www.themoviedb.org/tv/9/watch?locale=TW");
  });
  it("正在上映 → 查場次（Google 時刻表）", () => {
    expect(quickWatchLink({ kind: "movie", tmdbId: 1, title: "墜 2", section: "now_playing" })).toMatchObject({
      kind: "ticket",
      label: "訂票",
    });
  });
});

describe("watchInfoLinks：作品頁的 WatchInfo → 按鈕", () => {
  it("available 才有；沒網址的列略過", () => {
    expect(
      watchInfoLinks({
        status: "available",
        platforms: [
          { name: "Netflix", note: "訂閱", url: TMDB_LINK },
          { name: "壞資料", note: "", url: null },
        ],
        attribution: "資料來源：JustWatch / TMDB",
      }),
    ).toEqual([{ kind: "watch", source: "netflix", label: "Netflix", url: TMDB_LINK, origin: "tmdb", note: "訂閱" }]);
    expect(watchInfoLinks({ status: "in_theaters", platforms: [], attribution: null })).toEqual([]);
    expect(watchInfoLinks(null)).toEqual([]);
  });
});
