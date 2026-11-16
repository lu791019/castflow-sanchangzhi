import { describe, expect, it, vi } from "vitest";
import { resolvePrimaryLinks, resolveWorkLinks, type LinkWork, type WorkLinksDeps } from "./service";
import type { WorkLink } from "./types";

const NOW = new Date("2026-10-13T04:00:00Z");
const TMDB_LINK = "https://www.themoviedb.org/tv/66732/watch?locale=TW";

function deps(overrides: Partial<WorkLinksDeps> = {}): WorkLinksDeps {
  return {
    listStored: async () => [],
    loadWatchInfo: async () => null,
    warn: vi.fn(),
    ...overrides,
  };
}

const series: LinkWork = { id: "w1", kind: "series", title: "怪奇物語", tmdb_id: 66732, venue_type: null };
const live: LinkWork = { id: "w2", kind: "live", title: "落日飛車", tmdb_id: null, venue_type: "livehouse" };

describe("resolveWorkLinks：user > curated > tmdb > search", () => {
  it("影劇：使用者補的 Netflix 蓋過 curated 與 TMDB；搜尋墊底", async () => {
    const user: WorkLink = { kind: "watch", source: "netflix", label: "Netflix", url: "https://www.netflix.com/title/9", origin: "user", note: null };
    const result = await resolveWorkLinks(series, deps({
      listStored: async () => [user],
      loadWatchInfo: async () => ({ status: "available", platforms: [{ name: "Netflix", note: "訂閱", url: TMDB_LINK }, { name: "Catchplay", note: "租借", url: TMDB_LINK }], attribution: "資料來源：JustWatch / TMDB" }),
    }));
    expect(result.watch.map((link) => `${link.source}:${link.origin}`)).toEqual([
      "netflix:user",
      "catchplay:tmdb",
      "justwatch:search",
    ]);
    expect(result.missing).toBe(false);
    expect(result.watchInfo?.attribution).toBe("資料來源：JustWatch / TMDB");
  });

  it("影劇沒有任何真連結：curated 也沒有 → missing，只剩搜尋", async () => {
    const result = await resolveWorkLinks({ ...series, tmdb_id: 1 }, deps());
    expect(result.missing).toBe(true);
    expect(result.watch.map((link) => link.source)).toEqual(["justwatch"]);
  });

  it("curated 有 → 不算缺", async () => {
    const result = await resolveWorkLinks(series, deps());
    expect(result.watch[0]).toMatchObject({ source: "netflix", origin: "curated" });
    expect(result.missing).toBe(false);
  });

  it("上映中的電影：多一顆查場次", async () => {
    const result = await resolveWorkLinks({ ...series, kind: "movie", tmdb_id: 5 }, deps({
      loadWatchInfo: async () => ({ status: "in_theaters", platforms: [], attribution: null, since: "2026-10-01" }),
    }));
    expect(result.ticket.map((link) => link.source)).toEqual(["showtimes-search"]);
  });

  it("演出：場刊手填的 KKTIX 在前，venue_type 決定搜尋順序", async () => {
    const manual: WorkLink = { kind: "ticket", source: "kktix", label: "KKTIX", url: "https://kktix.com/events/x", origin: "manual", note: null };
    const result = await resolveWorkLinks(live, deps({ listStored: async () => [manual] }));
    expect(result.ticket.map((link) => `${link.source}:${link.origin}`)).toEqual([
      "kktix:manual",
      "accupass:search",
      "tixcraft:search",
    ]);
    expect(result.watchInfo).toBeNull();
  });

  it("讀 DB 失敗：推警報、退回只有搜尋連結（不 throw 到頁面）", async () => {
    const warn = vi.fn();
    const result = await resolveWorkLinks(live, deps({ listStored: async () => { throw new Error("boom"); }, warn }));
    expect(warn).toHaveBeenCalledWith("在哪看／買票連結讀取失敗，先只給搜尋連結", expect.stringContaining("boom"));
    expect(result.ticket.every((link) => link.origin === "search")).toBe(true);
    expect(result.missing).toBe(true);
  });

  it("Podcast：沒有連結區塊、不算缺，在哪聽照舊", async () => {
    const info = { status: "available" as const, platforms: [], attribution: null };
    const result = await resolveWorkLinks({ ...series, kind: "podcast_episode", tmdb_id: null }, deps({ loadWatchInfo: async () => info }));
    expect(result).toMatchObject({ watch: [], ticket: [], official: [], missing: false, watchInfo: info, spotify: null });
  });

  it("音樂有讀者補的 Spotify 直連：在哪聽換成直連、帶出播放器；類型不符的存檔當沒有", async () => {
    const album = "4aawyAB9vmqN3uQ7FjRGTy";
    const spotify: WorkLink = { kind: "watch", source: "spotify", label: "Spotify", url: `https://open.spotify.com/album/${album}`, origin: "user", note: null };
    const info = { status: "available" as const, attribution: null, platforms: [{ name: "Spotify", note: "搜尋", url: "https://open.spotify.com/search/x" }] };
    const music = { ...series, kind: "music" as const, tmdb_id: null };
    const result = await resolveWorkLinks(music, deps({ listStored: async () => [spotify], loadWatchInfo: async () => info }));
    expect(result.spotify).toEqual({ type: "album", id: album });
    expect(result.watchInfo?.platforms).toEqual([{ name: "Spotify", note: "直連", url: spotify.url }]);
    expect(result).toMatchObject({ watch: [], missing: false });

    const wrong = await resolveWorkLinks(music, deps({ listStored: async () => [{ ...spotify, url: `https://open.spotify.com/show/${album}` }], loadWatchInfo: async () => info }));
    expect(wrong).toMatchObject({ spotify: null, watchInfo: info });
  });
});

describe("resolvePrimaryLinks：列表每列一顆（批次，不打 TMDB）", () => {
  it("用 DB 快照、curated、場刊連結與搜尋組出每列的次鈕", () => {
    const manual: WorkLink = { kind: "ticket", source: "kktix", label: "KKTIX", url: "https://kktix.com/events/x", origin: "manual", note: null };
    const result = resolvePrimaryLinks(
      [
        { ...live, watch_providers: null },
        { ...series, tmdb_id: 1, watch_providers: { providers: [{ name: "Netflix", kind: "subscription", link: TMDB_LINK }], link: TMDB_LINK, releaseDate: null } },
        { id: "w3", kind: "exhibition", title: "光的抄寫", tmdb_id: null, venue_type: "museum", watch_providers: null },
      ],
      new Map([["w2", [manual]]]),
      NOW,
    );
    expect(result.get("w2")?.url).toBe("https://kktix.com/events/x");
    expect(result.get("w1")).toMatchObject({ source: "netflix", origin: "tmdb" });
    expect(result.get("w3")).toMatchObject({ kind: "official", origin: "search" });
  });
});
