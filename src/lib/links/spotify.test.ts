import { describe, expect, it } from "vitest";
import { checkListenLink, isSpotifyHost, parseSpotifyUrl, spotifyEmbedUrl, spotifyRefFor, spotifyUrl } from "./spotify";

const ALBUM = "4aawyAB9vmqN3uQ7FjRGTy";
const SHOW = "2MAi0BvDc6GTFvKFPXnkCL";

describe("parseSpotifyUrl：各種貼法 → 類型＋ID", () => {
  it("一般網址、追蹤參數、語系前綴、embed、http、結尾斜線都認得", () => {
    const expected = { ok: true, ref: { type: "album", id: ALBUM } };
    expect(parseSpotifyUrl(`https://open.spotify.com/album/${ALBUM}`)).toEqual(expected);
    expect(parseSpotifyUrl(`https://open.spotify.com/album/${ALBUM}?si=abc123&utm_source=copy-link`)).toEqual(expected);
    expect(parseSpotifyUrl(`https://open.spotify.com/intl-ja/album/${ALBUM}?si=x`)).toEqual(expected);
    expect(parseSpotifyUrl(`https://open.spotify.com/intl-zh-tw/album/${ALBUM}`)).toEqual(expected);
    expect(parseSpotifyUrl(`https://open.spotify.com/embed/album/${ALBUM}?utm_source=generator`)).toEqual(expected);
    expect(parseSpotifyUrl(`http://OPEN.SPOTIFY.COM/album/${ALBUM}/`)).toEqual(expected);
    expect(parseSpotifyUrl(`  https://open.spotify.com/album/${ALBUM}#x  `)).toEqual(expected);
  });

  it("四種類型", () => {
    for (const type of ["album", "track", "show", "episode"]) {
      expect(parseSpotifyUrl(`https://open.spotify.com/${type}/${SHOW}`)).toEqual({ ok: true, ref: { type, id: SHOW } });
    }
  });

  it("短網址不跟隨轉址，回 short_link", () => {
    expect(parseSpotifyUrl("https://spotify.link/AbCdEf")).toEqual({ ok: false, reason: "short_link" });
    expect(parseSpotifyUrl("https://spotify.app.link/AbCdEf")).toEqual({ ok: false, reason: "short_link" });
  });

  it("播放清單、歌手頁：不支援的類型", () => {
    expect(parseSpotifyUrl(`https://open.spotify.com/playlist/${ALBUM}`)).toEqual({ ok: false, reason: "unsupported_type" });
    expect(parseSpotifyUrl(`https://open.spotify.com/artist/${ALBUM}`)).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("ID 不對、多了路徑、只有首頁、其他 spotify 子網域：不完整", () => {
    expect(parseSpotifyUrl("https://open.spotify.com/album/short")).toEqual({ ok: false, reason: "malformed" });
    expect(parseSpotifyUrl(`https://open.spotify.com/album/${ALBUM}/extra`)).toEqual({ ok: false, reason: "malformed" });
    expect(parseSpotifyUrl("https://open.spotify.com/")).toEqual({ ok: false, reason: "malformed" });
    expect(parseSpotifyUrl(`https://play.spotify.com/album/${ALBUM}`)).toEqual({ ok: false, reason: "malformed" });
  });

  it("白名單外的網域、假冒網域、非 http(s) 都擋", () => {
    expect(parseSpotifyUrl(`https://open.spotify.com.evil.io/album/${ALBUM}`)).toEqual({ ok: false, reason: "not_spotify" });
    expect(parseSpotifyUrl(`https://evil-open.spotify.co/album/${ALBUM}`)).toEqual({ ok: false, reason: "not_spotify" });
    expect(parseSpotifyUrl(`https://kkbox.com/album/${ALBUM}`)).toEqual({ ok: false, reason: "not_spotify" });
    expect(parseSpotifyUrl(`spotify:album:${ALBUM}`)).toEqual({ ok: false, reason: "not_spotify" });
    expect(parseSpotifyUrl("javascript:alert(1)")).toEqual({ ok: false, reason: "not_spotify" });
  });
});

describe("正規化與播放器網址", () => {
  it("統一成 https://open.spotify.com/<type>/<id>", () => {
    expect(spotifyUrl({ type: "episode", id: SHOW })).toBe(`https://open.spotify.com/episode/${SHOW}`);
  });
  it("embed：明亮沿用封面取色、放映廳 theme=0", () => {
    expect(spotifyEmbedUrl({ type: "album", id: ALBUM }, false)).toBe(`https://open.spotify.com/embed/album/${ALBUM}?utm_source=generator`);
    expect(spotifyEmbedUrl({ type: "show", id: SHOW }, true)).toBe(`https://open.spotify.com/embed/show/${SHOW}?utm_source=generator&theme=0`);
  });
  it("isSpotifyHost：含子網域與短網址，不被假冒網域騙", () => {
    expect(isSpotifyHost(`https://open.spotify.com/album/${ALBUM}`)).toBe(true);
    expect(isSpotifyHost("https://spotify.link/x")).toBe(true);
    expect(isSpotifyHost("https://notspotify.com/x")).toBe(false);
    expect(isSpotifyHost("not a url")).toBe(false);
  });
});

describe("checkListenLink：類型要對得上作品類別", () => {
  it("音樂收專輯、歌曲，回正規化網址", () => {
    expect(checkListenLink("music", `https://open.spotify.com/intl-ja/album/${ALBUM}?si=x`)).toEqual({
      ok: true,
      ref: { type: "album", id: ALBUM },
      url: `https://open.spotify.com/album/${ALBUM}`,
    });
    expect(checkListenLink("music", `https://open.spotify.com/track/${ALBUM}`)).toMatchObject({ ok: true });
  });
  it("Podcast 收節目、單集", () => {
    expect(checkListenLink("podcast_episode", `https://open.spotify.com/show/${SHOW}?si=1`)).toMatchObject({
      ok: true,
      url: `https://open.spotify.com/show/${SHOW}`,
    });
    expect(checkListenLink("podcast_episode", `https://open.spotify.com/episode/${SHOW}`)).toMatchObject({ ok: true });
  });
  it("類型對不上：清楚說要貼什麼", () => {
    expect(checkListenLink("music", `https://open.spotify.com/show/${SHOW}`)).toEqual({ ok: false, error: "這是 Podcast 的連結，這裡要貼專輯或歌曲。" });
    expect(checkListenLink("podcast_episode", `https://open.spotify.com/album/${ALBUM}`)).toEqual({ ok: false, error: "這是音樂的連結，這裡要貼節目或單集。" });
  });
  it("短網址、播放清單、不完整、白名單外各有訊息", () => {
    expect(checkListenLink("music", "https://spotify.link/x")).toEqual({ ok: false, error: "短網址看不出是哪一張，請貼 open.spotify.com 開頭的完整網址。" });
    expect(checkListenLink("music", `https://open.spotify.com/playlist/${ALBUM}`)).toEqual({ ok: false, error: "播放清單、歌手頁不收，請貼專輯或歌曲的連結。" });
    expect(checkListenLink("podcast_episode", `https://open.spotify.com/artist/${ALBUM}`)).toEqual({ ok: false, error: "播放清單、歌手頁不收，請貼節目或單集的連結。" });
    expect(checkListenLink("music", "https://open.spotify.com/album/x")).toEqual({ ok: false, error: "這個 Spotify 網址不完整，再複製一次。" });
    expect(checkListenLink("music", "https://www.kkbox.com/tw/tc/album/x")).toEqual({ ok: false, error: "在哪聽目前只收 Spotify 連結（open.spotify.com）。" });
  });
  it("其他作品類別一律不收", () => {
    expect(checkListenLink("movie", `https://open.spotify.com/album/${ALBUM}`)).toEqual({ ok: false, error: "Spotify 連結只能補在音樂或 Podcast。" });
  });
  it("spotifyRefFor：讀出時再驗一次，類型不符當沒有", () => {
    expect(spotifyRefFor("music", `https://open.spotify.com/album/${ALBUM}`)).toEqual({ type: "album", id: ALBUM });
    expect(spotifyRefFor("music", `https://open.spotify.com/show/${SHOW}`)).toBeNull();
    expect(spotifyRefFor("series", `https://open.spotify.com/show/${SHOW}`)).toBeNull();
  });
});
