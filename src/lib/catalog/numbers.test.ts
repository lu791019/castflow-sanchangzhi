import { describe, expect, it } from "vitest";
import { dotDate, taipeiWeekStart } from "./numbers";

describe("dotDate（統計欄與日期用阿拉伯數字）", () => {
  it("台北時間 MM.DD", () => {
    expect(dotDate("2026-10-07T16:30:00Z")).toBe("10.08");
    expect(dotDate("2026-01-02T03:00:00Z")).toBe("01.02");
  });
  it("壞值回空字串", () => {
    expect(dotDate("not-a-date")).toBe("");
  });
});

describe("taipeiWeekStart（time.week：週一 00:00 起）", () => {
  it("週六晚上 → 同週週一 00:00 台北", () => {
    // 2026-10-10 是週六
    expect(taipeiWeekStart(new Date("2026-10-10T13:00:00Z")).toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
  it("週一凌晨 → 當天 00:00", () => {
    expect(taipeiWeekStart(new Date("2026-10-04T17:00:00Z")).toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
  it("週日 → 前一個週一", () => {
    expect(taipeiWeekStart(new Date("2026-10-11T04:00:00Z")).toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
});
