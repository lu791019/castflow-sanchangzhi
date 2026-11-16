import { describe, expect, it } from "vitest";
import { buildSearchResults, type SignedArticle } from "./results";
import type { CatalogWork } from "./shelves";

const work = (id: string, kind: string, title: string, extra: Partial<CatalogWork> = {}): CatalogWork => ({
  id,
  slug: id,
  kind,
  title,
  year: null,
  podcastShow: null,
  posterUrl: null,
  eventDate: null,
  issueNo: 1,
  ...extra,
});

const article = (id: string, penName: string, publishedAt: string, extra: Partial<SignedArticle> = {}): SignedArticle => ({
  id,
  userId: `u-${penName}`,
  penName,
  workId: null,
  workKind: null,
  publishedAt,
  shareSlug: `s-${id}`,
  ...extra,
});

const NOW = new Date("2026-10-10T12:00:00Z");

describe("buildSearchResults（混合結果：作品／作者／文章）", () => {
  const works = [
    work("w1", "movie", "海街日記", { year: 2015 }),
    work("w2", "live", "海街音樂會", { eventDate: "2026-10-09" }),
    work("w3", "movie", "一一"),
  ];
  const feelings = [
    { workId: "w1", userId: "a", publishedAt: "2026-10-01T00:00:00Z" },
    { workId: "w1", userId: "a", publishedAt: "2026-10-06T00:00:00Z" },
    { workId: "w1", userId: "b", publishedAt: "2026-10-07T00:00:00Z" },
    { workId: "w2", userId: "c", publishedAt: "2026-10-09T13:00:00Z" },
  ];
  const signed = [article("x", "海街小晴", "2026-10-08T00:00:00Z"), article("y", "阿哲", "2026-10-10T00:00:00Z")];
  const hits = [
    { article: signed[0], title: "看完電影，我傳了訊息", body: "# 看完電影\n\n沒有命中。" },
    { article: signed[1], title: "第二次看，我站在大姊那一邊", body: "重看《海街日記》才發現，梅酒要等一年。", column: "rewatch" as const },
  ];

  const result = buildSearchResults({ query: "海街", works, feelings, signed, articleHits: hits, now: NOW });

  it("作品：依最近一段排序；眉標含類型與年份／日期；統計用阿拉伯數字＋本週人數", () => {
    expect(result.works.map((item) => item.href)).toEqual(["/works/w2", "/works/w1"]);
    expect(result.works[1]).toMatchObject({ eyebrow: "作品・電影・2015", meta: "3 段感受・本週 2 人說過" });
    expect(result.works[0]).toMatchObject({ eyebrow: "作品・演出・10.09", meta: "1 段感受・本週 1 人說過", coverKind: "live" });
    expect(result.works[1].titleParts[0]).toEqual({ text: "海街", match: true });
  });
  it("作者：筆名命中，連到專欄頁，N 篇", () => {
    expect(result.authors).toHaveLength(1);
    expect(result.authors[0]).toMatchObject({
      penName: "海街小晴",
      href: `/authors/${encodeURIComponent("海街小晴")}`,
      meta: "1 篇・最近一篇 10.08",
    });
  });
  it("文章：只放命中標題或句子的；句子命中才附摘錄；眉標帶欄目", () => {
    expect(result.articles.map((item) => item.href)).toEqual(["/s/s-y"]);
    expect(result.articles[0]).toMatchObject({ eyebrow: "文章・重看", penName: "阿哲", date: "10.10" });
    expect(result.articles[0].snippetParts?.some((part) => part.match)).toBe(true);
  });
  it("沒有作品段數的作品不出現；空查詢回全空", () => {
    expect(buildSearchResults({ query: "一一", works, feelings, signed, articleHits: [], now: NOW }).works).toEqual([]);
    const empty = buildSearchResults({ query: "", works, feelings, signed, articleHits: hits, now: NOW });
    expect(empty.works.length + empty.authors.length + empty.articles.length).toBe(0);
  });
  it("Podcast 節目名也算命中", () => {
    const podcast = work("p1", "podcast_episode", "第 42 集", { podcastShow: "夜貓" });
    const found = buildSearchResults({
      query: "夜貓",
      works: [podcast],
      feelings: [{ workId: "p1", userId: "a", publishedAt: "2026-09-01T00:00:00Z" }],
      signed: [],
      articleHits: [],
      now: NOW,
    });
    expect(found.works[0]).toMatchObject({ eyebrow: "作品・Podcast・夜貓", meta: "1 段感受" });
  });
});

describe("buildSearchResults 作者列帶專欄名", () => {
  const signed: SignedArticle[] = [
    { id: "s1", userId: "u1", penName: "林小晴", workId: null, workKind: null, publishedAt: "2026-10-08T02:00:00Z", shareSlug: "a" },
    { id: "s2", userId: "u2", penName: "林阿哲", workId: null, workKind: null, publishedAt: "2026-10-09T02:00:00Z", shareSlug: "b" },
  ];
  const base = { query: "林", works: [], feelings: [], signed, articleHits: [], now: NOW };
  it("專欄名接在副標前面；沒取的只留篇數", () => {
    const plain = buildSearchResults(base).authors;
    const withNames = buildSearchResults({ ...base, columnNames: new Map([["林小晴", "公車上的散場"]]) }).authors;
    const metaOf = (list: typeof plain, name: string) => list.find((item) => item.penName === name)?.meta;
    expect(metaOf(withNames, "林小晴")).toBe(`公車上的散場・${metaOf(plain, "林小晴")}`);
    expect(metaOf(withNames, "林阿哲")).toBe(metaOf(plain, "林阿哲"));
  });
});

