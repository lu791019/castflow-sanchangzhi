import { describe, expect, it } from "vitest";
import { formatDayRange, lastSevenDaysStart, thisWeekStart } from "./week";

// 2026-10-10 是週六；台北 21:00 = UTC 13:00
const saturdayNight = new Date("2026-10-10T13:00:00Z");

describe("time.week：本週＝台北週一 00:00 至今", () => {
  it("週六晚上 → 週一 10.05 00:00（台北）", () => {
    expect(thisWeekStart(saturdayNight).toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
  it("週一凌晨 00:30（台北）仍是本週第一天", () => {
    const mondayEarly = new Date("2026-10-04T16:30:00Z");
    expect(thisWeekStart(mondayEarly).toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
  it("週日晚上 → 同一週的週一", () => {
    const sunday = new Date("2026-10-11T12:00:00Z");
    expect(thisWeekStart(sunday).toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
});

describe("sameShow.window：近 7 天（含今天）", () => {
  it("10.10 → 從 10.04 00:00（台北）起", () => {
    expect(lastSevenDaysStart(saturdayNight).toISOString()).toBe("2026-10-03T16:00:00.000Z");
  });
});

describe("日期區間文字", () => {
  it("MM.DD – MM.DD", () => {
    expect(formatDayRange(thisWeekStart(saturdayNight), saturdayNight, " – ")).toBe("10.05 – 10.10");
    expect(formatDayRange(lastSevenDaysStart(saturdayNight), saturdayNight, "–")).toBe("10.04–10.10");
  });
  it("同一天只寫一個日期", () => {
    const at = new Date("2026-09-21T03:00:00Z");
    expect(formatDayRange(at, at, " – ")).toBe("09.21");
  });
});
