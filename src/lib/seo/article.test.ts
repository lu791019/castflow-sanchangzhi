import { describe, expect, it } from "vitest";
import { articleJsonLd, articleSeoTitle, workSeoTitle } from "./article";
import { ROBOTS_DISALLOW } from "./robots";

describe("文章 <title> 公式", () => {
  it("帶作品名與「心得」；標題已含作品名就不重複；沒有作品只接站名", () => {
    expect(articleSeoTitle({ title: "一張下雨的照片", workTitle: "海街日記" })).toBe("《海街日記》心得・一張下雨的照片｜散場誌");
    expect(articleSeoTitle({ title: "剛看完《海街日記》", workTitle: "海街日記" })).toBe("剛看完《海街日記》｜散場誌");
    expect(articleSeoTitle({ title: " 無題 ", workTitle: null })).toBe("無題｜散場誌");
  });

  it("作品頁依類型用不同名詞", () => {
    expect(workSeoTitle("海街日記", "movie")).toBe("《海街日記》心得與評價｜散場誌");
    expect(workSeoTitle("股癌", "podcast_episode")).toBe("《股癌》聽後感｜散場誌");
    expect(workSeoTitle("光的抄寫", "exhibition")).toBe("《光的抄寫》觀後感｜散場誌");
  });
});

describe("JSON-LD", () => {
  it("Article 帶作者、出版者、about 作品、絕對網址", () => {
    const ld = articleJsonLd({
      origin: "https://castflow.daydreamdex.com",
      slug: "abc",
      headline: "一張下雨的照片",
      description: "散場時外面下著雨。",
      authorName: "散場的人",
      authorPath: "/authors/%E6%95%A3",
      publishedAt: "2026-10-11T13:00:00Z",
      imageUrl: "https://castflow.daydreamdex.com/s/abc/opengraph-image",
      work: { kind: "movie", title: "海街日記", year: 2015 },
    });
    expect(ld).toMatchObject({
      "@type": "Article",
      url: "https://castflow.daydreamdex.com/s/abc",
      author: { "@type": "Person", name: "散場的人", url: "https://castflow.daydreamdex.com/authors/%E6%95%A3" },
      about: { "@type": "Movie", name: "海街日記", datePublished: "2015" },
      inLanguage: "zh-Hant",
    });
  });

  it("匿名作者沒有連結；沒有作品沒有 about", () => {
    const ld = articleJsonLd({ origin: "https://x", slug: "s", headline: "h", description: null, authorName: "匿名", authorPath: null, publishedAt: null, imageUrl: null, work: null });
    expect(ld).not.toHaveProperty("about");
    expect((ld.author as Record<string, unknown>).url).toBeUndefined();
  });
});

describe("robots", () => {
  it("私人與流程頁都不索引，公開刊物不在清單裡", () => {
    for (const path of ["/me", "/journal", "/before", "/say", "/api/", "/proof/"]) expect(ROBOTS_DISALLOW).toContain(path);
    for (const path of ["/s/", "/works", "/catalog", "/authors"]) expect(ROBOTS_DISALLOW).not.toContain(path);
  });
});
