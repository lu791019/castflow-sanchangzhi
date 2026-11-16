import { describe, expect, it } from "vitest";
import {
  fitsVertical,
  layoutResonance,
  normalizeQuote,
  quoteLength,
  RESONANCE_MAX_CHARS,
  selectResonanceQuotes,
} from "./resonance";

const short = (author: string, quote = "梅酒要等一年，原來在乎也是。") => ({
  quote,
  author,
});

describe("句子正規化與計字", () => {
  it("去掉外層引號", () => {
    expect(normalizeQuote("「我好想有人叫我回家吃飯。」")).toBe("我好想有人叫我回家吃飯。");
  });
  it("22 字以內可直排、超過不可", () => {
    const exact = "一".repeat(RESONANCE_MAX_CHARS);
    expect(quoteLength(`「${exact}」`)).toBe(22);
    expect(fitsVertical(exact)).toBe(true);
    expect(fitsVertical(`${exact}二`)).toBe(false);
  });
});

describe("四態排版", () => {
  it("E：零句 → 空白稿紙", () => {
    expect(layoutResonance([])).toEqual({ variant: "E" });
  });
  it("C：只有一句 → 橫排", () => {
    const layout = layoutResonance([short("小魚")]);
    expect(layout.variant).toBe("C");
  });
  it("C：兩句但一句超過 22 字 → 橫排取第一句", () => {
    const long = "一".repeat(30);
    const layout = layoutResonance([short("甲", long), short("乙")]);
    expect(layout).toEqual({ variant: "C", quote: { quote: long, author: "甲" } });
  });
  it("B：兩句可直排", () => {
    const layout = layoutResonance([short("阿哲"), short("呂呂")]);
    expect(layout.variant).toBe("B");
    if (layout.variant === "B") expect(layout.quotes).toHaveLength(2);
  });
  it("B：三句中一句超長被排除 → 兩句直排", () => {
    const layout = layoutResonance([short("甲"), short("乙", "一".repeat(23)), short("丙")]);
    expect(layout.variant).toBe("B");
    if (layout.variant === "B") {
      expect(layout.quotes.map((item) => item.author)).toEqual(["甲", "丙"]);
    }
  });
  it("A：三句以上取前三", () => {
    const layout = layoutResonance([short("1"), short("2"), short("3"), short("4")]);
    expect(layout.variant).toBe("A");
    if (layout.variant === "A") {
      expect(layout.quotes.map((item) => item.author)).toEqual(["1", "2", "3"]);
    }
  });
});

describe("選句", () => {
  it("依發表時間早到晚、同作者只留最早一句、去空句", () => {
    const quotes = selectResonanceQuotes([
      { quote: "「第三句」", author: "Kai", publishedAt: "2026-10-09T00:00:00Z" },
      { quote: "第一句", author: "林小晴", publishedAt: "2026-10-01T00:00:00Z" },
      { quote: "同作者第二句", author: "林小晴", publishedAt: "2026-10-05T00:00:00Z" },
      { quote: "第二句", author: "阿哲", publishedAt: "2026-10-03T00:00:00Z" },
      { quote: "「」", author: "空", publishedAt: "2026-10-02T00:00:00Z" },
    ]);
    expect(quotes).toEqual([
      { quote: "第一句", author: "林小晴" },
      { quote: "第二句", author: "阿哲" },
      { quote: "第三句", author: "Kai" },
    ]);
  });
});
