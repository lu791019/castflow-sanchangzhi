import { describe, expect, it } from "vitest";
import { cjkSpacing, countText, monthDayText, verticalDigitRuns } from "./digits";

describe("countText（全站數量一律阿拉伯數字）", () => {
  it("整數照寫", () => {
    expect(countText(0)).toBe("0");
    expect(countText(2)).toBe("2");
    expect(countText(101)).toBe("101");
    expect(countText(12345)).toBe("12345");
  });

  it("負數與小數收成非負整數", () => {
    expect(countText(-3)).toBe("0");
    expect(countText(3.7)).toBe("3");
    expect(countText(Number.NaN)).toBe("0");
  });
});

describe("monthDayText", () => {
  it("月日不補零、數字與中文間半形空格", () => {
    expect(monthDayText(10, 9)).toBe("10 月 9 日");
    expect(monthDayText(1, 22)).toBe("1 月 22 日");
  });
});

describe("verticalDigitRuns（直排：1–2 位數字併成一格）", () => {
  it("切出數字段，並拿掉數字旁的半形空格", () => {
    expect(verticalDigitRuns("10 月 9 日")).toEqual([
      { text: "10", kind: "combine" },
      { text: "月", kind: "text" },
      { text: "9", kind: "combine" },
      { text: "日", kind: "text" },
    ]);
  });

  it("三位以上逐字直立", () => {
    expect(verticalDigitRuns("作品特輯・第 0142 號")).toEqual([
      { text: "作品特輯・第", kind: "text" },
      { text: "0142", kind: "upright" },
      { text: "號", kind: "text" },
    ]);
  });

  it("沒有數字原樣一段；空字串回空陣列", () => {
    expect(verticalDigitRuns("即將開展")).toEqual([{ text: "即將開展", kind: "text" }]);
    expect(verticalDigitRuns("")).toEqual([]);
  });

  it("中文之間的空格保留", () => {
    expect(verticalDigitRuns("展期中・還有 3 天")).toEqual([
      { text: "展期中・還有", kind: "text" },
      { text: "3", kind: "combine" },
      { text: "天", kind: "text" },
    ]);
  });
});

describe("cjkSpacing（中文與數字之間補半形空格）", () => {
  it("前後都補", () => {
    expect(cjkSpacing("隔了2天，最記得的是哪一首？")).toBe("隔了 2 天，最記得的是哪一首？");
  });

  it("已有空格、標點、拉丁日期不動", () => {
    expect(cjkSpacing("10.09 晚上・2 天後")).toBe("10.09 晚上・2 天後");
    expect(cjkSpacing("隔了半天")).toBe("隔了半天");
  });
});
