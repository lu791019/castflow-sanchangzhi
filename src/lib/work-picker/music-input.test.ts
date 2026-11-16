import { describe, expect, it } from "vitest";
import { allowsAnonymousCreate, parseCreateWorkInput, parseSearchParams } from "./input";
import { musicSlug } from "./slug";
import { musicWorkInsert } from "./work-rows";

describe("音樂：搜尋與建立的輸入", () => {
  it("搜尋 kind=music 合法", () => {
    expect(parseSearchParams(new URLSearchParams({ kind: "music", q: "告五人" }))).toEqual({
      ok: true,
      value: { kind: "music", query: "告五人" },
    });
  });

  it("建立：source=music 只收 itunesId 正整數（名稱、封面由 server 向 iTunes 取回）", () => {
    expect(parseCreateWorkInput({ source: "music", itunesId: 6812635395, title: "亂填" })).toEqual({
      ok: true,
      value: { source: "music", itunesId: 6812635395 },
    });
    expect(parseCreateWorkInput({ source: "music", itunesId: "1" }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "music" }).ok).toBe(false);
  });

  it("手動輸入可選 music 類型", () => {
    expect(parseCreateWorkInput({ source: "manual", kind: "music", title: "地下錄音帶" })).toMatchObject({
      ok: true,
      value: { kind: "music", title: "地下錄音帶" },
    });
  });

  it("專輯來自 iTunes 標準資料且以 itunes_id 去重 → 未登入也可建", () => {
    expect(allowsAnonymousCreate({ source: "music", itunesId: 1 })).toBe(true);
  });
});

describe("音樂：works 列", () => {
  it("專輯 → music 列：credit=歌手、poster=封面、itunes_id、slug 固定", () => {
    const row = musicWorkInsert({
      kind: "music",
      itunesId: 6812635395,
      title: "要去什麼地方",
      artist: "田馥甄",
      year: 2026,
      trackCount: 10,
      artworkUrl: "https://is1-ssl.mzstatic.com/a/600x600bb.jpg",
      feelingCount: 0,
    });
    expect(row).toEqual({
      kind: "music",
      title: "要去什麼地方",
      original_title: null,
      year: 2026,
      region: null,
      credit: "田馥甄",
      poster_url: "https://is1-ssl.mzstatic.com/a/600x600bb.jpg",
      tmdb_id: null,
      podcast_show: null,
      episode_number: null,
      slug: "music-6812635395",
      feed_url: null,
      itunes_id: 6812635395,
      episode_guid: null,
    });
    expect(musicSlug(6812635395)).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
  });
});
