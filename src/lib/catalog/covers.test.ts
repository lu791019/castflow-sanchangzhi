import { describe, expect, it } from "vitest";
import { columnCounts, heroLine, latestOf, shortLine } from "./covers";

describe("columnCounts", () => {
  it("五欄都有值，沒有的補 0", () => {
    const counts = columnCounts(new Map([["a", "essay"], ["b", "essay"], ["c", "rewatch"]] as const));
    expect(counts).toEqual({ essay: 2, commute: 0, one_line: 0, onsite: 0, rewatch: 1 });
  });
});

describe("shortLine（一集一句封面上的短句）", () => {
  it("取第一個分句，帶句號", () => {
    expect(shortLine("空是乾淨的，所以我留著。")).toBe("空是乾淨的。");
  });
  it("太長或空值不放", () => {
    expect(shortLine("這是一句非常非常長而且沒有任何標點的句子")).toBeNull();
    expect(shortLine(null)).toBeNull();
    expect(shortLine("  ")).toBeNull();
  });
});

describe("heroLine（索引大標：阿拉伯數字）", () => {
  it("作品數與說過的人數", () => {
    expect(heroLine(101, 64)).toEqual(["101 部作品，", "64 個人說過。"]);
  });
  it("空的時候", () => {
    expect(heroLine(0, 0)).toEqual(["索引還是空的，", "等第一個人說。"]);
  });
});

describe("latestOf", () => {
  it("取最新的一筆；空陣列回 null", () => {
    expect(latestOf([{ publishedAt: "2026-10-01" }, { publishedAt: "2026-10-09" }])).toEqual({ publishedAt: "2026-10-09" });
    expect(latestOf([])).toBeNull();
  });
});
