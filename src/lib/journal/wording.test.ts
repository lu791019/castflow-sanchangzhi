import { describe, expect, it } from "vitest";
import { fromTaipei } from "./time";
import {
  dayPeriod,
  gapPhrase,
  logicalDaysBetween,
  relativeDayWord,
  workCategory,
} from "./wording";

const at = (month: number, day: number, hour: number, minute = 0) =>
  fromTaipei(2026, month, day, hour, minute);

describe("dayPeriod（設計稿時段：早上 5–11、中午 11–14、下午 14–18、晚上 18–23、深夜 23–5）", () => {
  it.each([
    [5, "早上"],
    [10, "早上"],
    [11, "中午"],
    [13, "中午"],
    [14, "下午"],
    [17, "下午"],
    [18, "晚上"],
    [22, "晚上"],
    [23, "深夜"],
    [0, "深夜"],
    [4, "深夜"],
  ])("%i 點 → %s", (hour, expected) => {
    expect(dayPeriod(at(10, 7, hour))).toBe(expected);
  });
});

describe("logicalDaysBetween（4 點換日）", () => {
  it("晚上看完、隔天中午 → 1", () => {
    expect(logicalDaysBetween(at(10, 7, 21), at(10, 8, 12))).toBe(1);
  });

  it("凌晨 1 點看完、當天中午 → 1（算前一晚）", () => {
    expect(logicalDaysBetween(at(10, 8, 1), at(10, 8, 12))).toBe(1);
  });

  it("負值歸 0", () => {
    expect(logicalDaysBetween(at(10, 8, 12), at(10, 7, 12))).toBe(0);
  });
});

describe("relativeDayWord", () => {
  it("隔天、晚上 → 昨晚", () => {
    expect(relativeDayWord(at(10, 7, 21), at(10, 8, 12))).toBe("昨晚");
  });

  it("隔天、白天 → 昨天下午", () => {
    expect(relativeDayWord(at(10, 7, 15), at(10, 8, 12))).toBe("昨天下午");
  });

  it("同一天 → 時段（早上）", () => {
    expect(relativeDayWord(at(10, 7, 8), at(10, 7, 20))).toBe("早上");
  });

  it("同一天晚上 → 今晚", () => {
    expect(relativeDayWord(at(10, 7, 19), at(10, 7, 23, 30))).toBe("今晚");
  });

  it("2–6 天 → 週幾", () => {
    // 2026-10-03 是週六
    expect(relativeDayWord(at(10, 3, 19), at(10, 6, 12))).toBe("週六");
  });

  it("7 天以上 → 日期", () => {
    expect(relativeDayWord(at(10, 1, 19), at(10, 9, 12))).toBe("10.01");
  });
});

describe("gapPhrase", () => {
  it.each([
    [0, "半天"],
    [1, "1 天"],
    [2, "2 天"],
    [6, "6 天"],
    [7, "一陣子"],
  ])("%i 天 → %s", (days, expected) => {
    expect(gapPhrase(days)).toBe(expected);
  });
});

describe("workCategory", () => {
  it("作品類型優先", () => {
    expect(workCategory("podcast_episode", "cinema")).toBe("podcast");
    expect(workCategory("series", "home")).toBe("screen");
    expect(workCategory("live", "home")).toBe("live");
    expect(workCategory("exhibition", "home")).toBe("exhibition");
  });

  it("沒有作品看場域", () => {
    expect(workCategory(null, "live")).toBe("live");
    expect(workCategory(null, "exhibition")).toBe("exhibition");
    expect(workCategory(null, "cinema")).toBe("screen");
  });
});
