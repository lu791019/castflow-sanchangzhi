import { describe, expect, it } from "vitest";
import { allowsAnonymousCreate, parseCreateWorkInput, parseFeedParam, parseSearchParams } from "./input";

describe("parseSearchParams", () => {
  it("合法 kind + q", () => {
    expect(parseSearchParams(new URLSearchParams("kind=movie&q=海街日記"))).toEqual({
      ok: true,
      value: { kind: "movie", query: "海街日記" },
    });
  });
  it("kind 不在 movie/series/podcast → 錯誤", () => {
    const result = parseSearchParams(new URLSearchParams("kind=book&q=海街"));
    expect(result.ok).toBe(false);
  });
  it("q 不足 2 字 → 錯誤；超過 100 字截斷", () => {
    expect(parseSearchParams(new URLSearchParams("kind=movie&q=海")).ok).toBe(false);
    const long = parseSearchParams(new URLSearchParams(`kind=movie&q=${"a".repeat(150)}`));
    expect(long.ok && long.value.query.length).toBe(100);
  });
});

describe("parseFeedParam", () => {
  it("只接受 http(s) URL", () => {
    expect(parseFeedParam("https://feeds.example.com/a.xml")).toEqual({
      ok: true,
      value: "https://feeds.example.com/a.xml",
    });
    expect(parseFeedParam("ftp://x").ok).toBe(false);
    expect(parseFeedParam(null).ok).toBe(false);
    expect(parseFeedParam("not a url").ok).toBe(false);
  });
});

describe("parseCreateWorkInput", () => {
  it("tmdb：kind 限 movie/series，tmdbId 正整數", () => {
    expect(parseCreateWorkInput({ source: "tmdb", kind: "movie", tmdbId: 331482 })).toEqual({
      ok: true,
      value: { source: "tmdb", kind: "movie", tmdbId: 331482 },
    });
    expect(parseCreateWorkInput({ source: "tmdb", kind: "podcast", tmdbId: 1 }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "tmdb", kind: "movie", tmdbId: -1 }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "tmdb", kind: "movie", tmdbId: "12" }).ok).toBe(false);
  });
  it("podcast：feedUrl 為 http(s)、guid 非空；itunesId 可省略", () => {
    expect(
      parseCreateWorkInput({ source: "podcast", feedUrl: "https://a/f.xml", guid: "g1" }),
    ).toEqual({ ok: true, value: { source: "podcast", feedUrl: "https://a/f.xml", guid: "g1", itunesId: null } });
    expect(
      parseCreateWorkInput({ source: "podcast", feedUrl: "https://a/f.xml", guid: "g1", itunesId: 42 }),
    ).toEqual({ ok: true, value: { source: "podcast", feedUrl: "https://a/f.xml", guid: "g1", itunesId: 42 } });
    expect(parseCreateWorkInput({ source: "podcast", feedUrl: "https://a/f.xml", guid: "" }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "podcast", feedUrl: "javascript:x", guid: "g" }).ok).toBe(false);
  });
  it("manual：title 必填、去空白、上限 120 字；kind 為三種 works.kind", () => {
    expect(parseCreateWorkInput({ source: "manual", kind: "series", title: "  夜車上的海 " })).toEqual({
      ok: true,
      value: { source: "manual", kind: "series", title: "夜車上的海" },
    });
    expect(parseCreateWorkInput({ source: "manual", kind: "podcast_episode", title: "x" }).ok).toBe(true);
    expect(parseCreateWorkInput({ source: "manual", kind: "podcast", title: "x" }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "manual", kind: "movie", title: "   " }).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "manual", kind: "movie", title: "a".repeat(121) }).ok).toBe(false);
  });
  it("非物件或未知 source → 錯誤", () => {
    expect(parseCreateWorkInput(null).ok).toBe(false);
    expect(parseCreateWorkInput({ source: "wiki" }).ok).toBe(false);
  });
});

describe("allowsAnonymousCreate", () => {
  it("TMDB 與 Podcast 來自外部標準資料、會去重 → 未登入也可建（先說後登入）", () => {
    expect(allowsAnonymousCreate({ source: "tmdb", kind: "movie", tmdbId: 315846 })).toBe(true);
    expect(allowsAnonymousCreate({ source: "podcast", feedUrl: "https://f.example/rss", guid: "g", itunesId: null })).toBe(true);
  });

  it("手動輸入是任意文字 → 要登入", () => {
    expect(allowsAnonymousCreate({ source: "manual", kind: "movie", title: "海角七號" })).toBe(false);
  });
});
