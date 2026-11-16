import { describe, expect, it } from "vitest";
import { highlight, includesQuery, likePattern, normalizeQuery, snippetAround } from "./search";

describe("normalizeQuery", () => {
  it("去頭尾空白、合併空白、上限 40 字", () => {
    expect(normalizeQuery("  海街  日記 ")).toBe("海街 日記");
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery("字".repeat(60))).toHaveLength(40);
  });
  it("陣列參數取第一個", () => {
    expect(normalizeQuery(["海街", "x"])).toBe("海街");
  });
});

describe("likePattern（萬用字元跳脫）", () => {
  it("包成 %q%，跳脫 % _ \\，拿掉 PostgREST 的 *", () => {
    expect(likePattern("海街")).toBe("%海街%");
    expect(likePattern("100%_a\\b*")).toBe("%100\\%\\_a\\\\b%");
  });
});

describe("includesQuery（不分大小寫）", () => {
  it("英文不分大小寫", () => {
    expect(includesQuery("Subtitles Off", "subtitles")).toBe(true);
    expect(includesQuery("海街日記", "日記")).toBe(true);
    expect(includesQuery("海街日記", "")).toBe(false);
  });
});

describe("highlight（search.match 命中字）", () => {
  it("切出命中段，保留原字大小寫", () => {
    expect(highlight("看完《海街日記》，想起海街", "海街")).toEqual([
      { text: "看完《", match: false },
      { text: "海街", match: true },
      { text: "日記》，想起", match: false },
      { text: "海街", match: true },
    ]);
    expect(highlight("Kai and KAI", "kai")).toEqual([
      { text: "Kai", match: true },
      { text: " and ", match: false },
      { text: "KAI", match: true },
    ]);
  });
  it("沒命中或空查詢回整段", () => {
    expect(highlight("一一", "海")).toEqual([{ text: "一一", match: false }]);
    expect(highlight("一一", "")).toEqual([{ text: "一一", match: false }]);
  });
});

describe("snippetAround（文章句子命中）", () => {
  const body = "# 標題\n\n第一段沒有。重看《海街日記》才發現，梅酒要等一年，原來在乎也是。最後一句。\n\n**粗體**的海街坡道。";
  it("回傳含命中字的那一句（去掉 Markdown）", () => {
    expect(snippetAround(body, "梅酒")).toBe("重看《海街日記》才發現，梅酒要等一年，原來在乎也是。");
    expect(snippetAround(body, "粗體")).toBe("粗體的海街坡道。");
  });
  it("標題行不算句子；沒有命中回 null", () => {
    expect(snippetAround(body, "標題")).toBeNull();
    expect(snippetAround(body, "鯨魚")).toBeNull();
  });
  it("太長的句子以命中處為中心截斷加刪節號", () => {
    const long = `${"前".repeat(80)}海街${"後".repeat(80)}。`;
    const snippet = snippetAround(long, "海街", 30) ?? "";
    expect(snippet).toContain("海街");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.replace(/…/g, "").length).toBeLessThanOrEqual(30);
  });
});
