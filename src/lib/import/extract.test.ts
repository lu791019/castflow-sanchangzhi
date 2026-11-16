import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeHtml } from "./decode";
import { articleMarkdown, extractArticle, normalizePublishedAt } from "./extract";

const NOW = new Date("2026-10-14T02:00:00Z");
const read = (name: string, type = "text/html") =>
  decodeHtml(new Uint8Array(readFileSync(join(__dirname, "__fixtures__", name))), type);

describe("extractArticle", () => {
  it("WordPress：標題去站名、保留段落與小標、去掉導覽廣告留言側欄", () => {
    const result = extractArticle(read("wordpress.html"), "https://blog.example.com/2015/04/master", NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const article = result.value;
    expect(article.title).toBe("《師父》：規矩森嚴的武林");
    expect(article.publishedAt).toBe("2015-04-02T02:30:00.000Z");
    expect(article.imageUrl).toBe("https://blog.example.com/wp-content/uploads/2015/04/master.jpg");
    const texts = article.blocks.map((block) => (block.type === "list" ? block.items.join("/") : block.text));
    expect(texts[0]).toMatch(/^徐浩峰的武林/);
    expect(texts).toContain("規矩是一把刀");
    expect(texts).toContain("師父要犧牲徒弟/徒弟要成全師父");
    // <br> 拆成兩段
    expect(texts).toContain("可是徒弟贏了之後，就得被趕出天津，師父才能留下來。");
    const all = texts.join("\n");
    for (const noise of ["贊助廣告", "首頁", "好文推推", "熱門文章", "版權所有", "分享到"]) {
      expect(all).not.toContain(noise);
    }
    // 正文開頭不重複標題
    expect(all).not.toContain("《師父》：規矩森嚴的武林");
  });

  it("JSON-LD 的 datePublished 與 image", () => {
    const result = extractArticle(read("jsonld-date.html"), "https://blog.example.com/voice", NOW);
    expect(result.ok && result.value.publishedAt).toBe("2019-11-23T13:05:00.000Z");
    expect(result.ok && result.value.title).toBe("人聲：聽見自己的聲音");
    expect(result.ok && result.value.blocks.length).toBe(3);
  });

  it("Big5 頁面解碼後抽得到正文；沒有日期為 null", () => {
    const result = extractArticle(read("big5.html"), "https://old.example.com/tree", NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe("樹大招風");
    expect(result.value.publishedAt).toBeNull();
    expect(result.value.blocks[0]).toEqual({ type: "paragraph", text: expect.stringMatching(/^樹大招風拍的是/) });
  });

  it("抽不到正文（首頁、列表）→ 明確錯誤", () => {
    expect(extractArticle(read("homepage.html"), "https://blog.example.com/", NOW)).toEqual({
      ok: false,
      error: "這個網址抓不到正文，請貼單篇文章的網址",
    });
    expect(extractArticle("", "https://blog.example.com/", NOW)).toMatchObject({ ok: false });
  });

  it("相對路徑首圖補成絕對網址；非 https 首圖丟掉", () => {
    const html = read("jsonld-date.html").replace("https://blog.example.com/voice.png", "/img/voice.png");
    const result = extractArticle(html, "https://blog.example.com/voice", NOW);
    expect(result.ok && result.value.imageUrl).toBe("https://blog.example.com/img/voice.png");
    const insecure = read("jsonld-date.html").replace("https://blog.example.com/voice.png", "http://x.example.com/a.png");
    const second = extractArticle(insecure, "https://blog.example.com/voice", NOW);
    expect(second.ok && second.value.imageUrl).toBeNull();
  });
});

describe("normalizePublishedAt", () => {
  it("合法日期轉 ISO；未來、太早、格式錯回 null", () => {
    expect(normalizePublishedAt("2015-04-02", NOW)).toBe("2015-04-02T00:00:00.000Z");
    expect(normalizePublishedAt("2027-01-01", NOW)).toBeNull();
    expect(normalizePublishedAt("1980-01-01", NOW)).toBeNull();
    expect(normalizePublishedAt("昨天", NOW)).toBeNull();
    expect(normalizePublishedAt(null, NOW)).toBeNull();
  });
});

describe("articleMarkdown", () => {
  it("轉成文章頁吃的 Markdown；行首像語法的字元不被誤判", () => {
    const markdown = articleMarkdown("標題", [
      { type: "paragraph", text: "第一段" },
      { type: "heading", text: "小標" },
      { type: "list", items: ["甲", "乙"] },
      { type: "paragraph", text: "# 不是標題" },
    ]);
    expect(markdown).toBe("# 標題\n\n第一段\n\n## 小標\n\n- 甲\n- 乙\n\n​# 不是標題");
  });
});
