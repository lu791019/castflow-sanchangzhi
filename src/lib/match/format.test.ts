import { describe, expect, it } from "vitest";
import { matchHeading, matchMeta, matchReasons } from "./format";

describe("matchHeading", () => {
  it("以配到最多部的那位寫 N", () => {
    expect(matchHeading([{ commonCount: 2 }, { commonCount: 5 }])).toBe("有人跟你看了同樣 5 部");
  });
});

describe("matchMeta", () => {
  it("同樣 N 部＋最多 3 個書名號作品名，阿拉伯數字", () => {
    expect(matchMeta({ commonCount: 4, titles: ["花樣年華", "悲情城市", "一一"] })).toBe("同樣 4 部・《花樣年華》《悲情城市》《一一》");
  });

  it("作品名讀不到時只寫部數", () => {
    expect(matchMeta({ commonCount: 1, titles: [] })).toBe("同樣 1 部");
  });
});

describe("matchHeading：只有寫得像、沒有共同作品時", () => {
  it("改寫成「有人寫的東西跟你很像」", () => {
    expect(matchHeading([{ commonCount: 0 }])).toBe("有人寫的東西跟你很像");
  });
});

describe("matchReasons", () => {
  it("共同作品＋寫的東西很像：兩行", () => {
    expect(matchReasons({ commonCount: 2, titles: ["一一"], similarTitle: "那晚的雨" })).toEqual([
      "同樣 2 部・《一一》",
      "你們寫的東西很像・〈那晚的雨〉",
    ]);
  });

  it("只有寫得像：一行；標題讀不到就不帶", () => {
    expect(matchReasons({ commonCount: 0, titles: [], similarTitle: "那晚的雨" })).toEqual(["你們寫的東西很像・〈那晚的雨〉"]);
    expect(matchReasons({ commonCount: 0, titles: [], similarTitle: " " })).toEqual(["你們寫的東西很像"]);
  });

  it("只有共同作品：同原本", () => {
    expect(matchReasons({ commonCount: 1, titles: [], similarTitle: null })).toEqual(["同樣 1 部"]);
  });
});
