import { describe, expect, it } from "vitest";
import { musicListenInfo } from "./music-links";
import { isListenWorkKind, listenTellUsCopy, spotifyRefOf, withSpotifyListen } from "./listen";
import type { WorkLink } from "./types";

const ALBUM = "4aawyAB9vmqN3uQ7FjRGTy";
const SHOW = "2MAi0BvDc6GTFvKFPXnkCL";

function stored(url: string, source = "spotify"): WorkLink {
  return { kind: "watch", source, label: "Spotify", url, origin: "user", note: null };
}

describe("withSpotifyListen：在哪聽疊上 Spotify 直連", () => {
  it("音樂：Spotify 搜尋列換成直連，其他平台順序不動", () => {
    const info = withSpotifyListen(musicListenInfo({ title: "我肯定在幾百年前就說過愛你", credit: "告五人", itunes_id: 1 }), { type: "album", id: ALBUM });
    expect(info.platforms.map((row) => `${row.name}:${row.note}`)).toEqual(["Apple Music:專輯頁", "Spotify:直連", "KKBOX:搜尋", "YouTube Music:搜尋"]);
    expect(info.platforms[1]?.url).toBe(`https://open.spotify.com/album/${ALBUM}`);
    expect(info.platforms.some((row) => row.url?.includes("/search/"))).toBe(false);
  });

  it("Podcast：插在 Apple Podcasts 後、RSS 前", () => {
    const info = withSpotifyListen(
      { status: "available", attribution: null, platforms: [{ name: "Apple Podcasts", note: "免費", url: "https://podcasts.apple.com/tw/podcast/id1" }, { name: "RSS", note: "訂閱網址", url: "https://a.tw/rss" }] },
      { type: "show", id: SHOW },
    );
    expect(info.platforms.map((row) => row.name)).toEqual(["Apple Podcasts", "Spotify", "RSS"]);
  });

  it("Podcast 原本查不到平台 → 只有 Spotify 一列；只有 RSS → Spotify 放第一列", () => {
    expect(withSpotifyListen({ status: "none", platforms: [], attribution: null }, { type: "episode", id: SHOW })).toEqual({
      status: "available",
      attribution: null,
      platforms: [{ name: "Spotify", note: "直連", url: `https://open.spotify.com/episode/${SHOW}` }],
    });
    expect(withSpotifyListen({ status: "available", platforms: [{ name: "RSS", note: "", url: "https://a.tw/rss" }], attribution: null }, { type: "show", id: SHOW }).platforms.map((row) => row.name)).toEqual(["Spotify", "RSS"]);
  });

  it("疊兩次不會重複（server 已疊、client 又疊同一筆）", () => {
    const once = withSpotifyListen(null, { type: "album", id: ALBUM });
    expect(withSpotifyListen(once, { type: "album", id: ALBUM })).toEqual(once);
  });
});

describe("spotifyRefOf：存的連結 → 播放器", () => {
  it("找 source spotify 的那筆、類型要對得上", () => {
    expect(spotifyRefOf("music", [stored("https://kktix.com/x", "kktix"), stored(`https://open.spotify.com/album/${ALBUM}`)])).toEqual({ type: "album", id: ALBUM });
    expect(spotifyRefOf("music", [stored(`https://open.spotify.com/show/${SHOW}`)])).toBeNull();
    expect(spotifyRefOf("podcast_episode", [])).toBeNull();
  });
  it("isListenWorkKind、告訴我們的字", () => {
    expect(isListenWorkKind("music")).toBe(true);
    expect(isListenWorkKind("podcast_episode")).toBe(true);
    expect(isListenWorkKind("movie")).toBe(false);
    expect(listenTellUsCopy("podcast_episode").placeholder).toContain("/show/");
    expect(listenTellUsCopy("music").footnote).toContain("專輯、歌曲");
  });
});
