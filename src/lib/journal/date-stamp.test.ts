import { describe, expect, it } from "vitest";
import { dateStamp } from "./wording";

/** 台北時間建構（UTC+8） */
const taipei = (iso: string) => new Date(`${iso}+08:00`);

describe("dateStamp", () => {
  it.each([
    ["2026-10-08T21:00:00", "10 月 8 日"],
    ["2026-12-22T12:00:00", "12 月 22 日"],
    ["2026-02-02T12:00:00", "2 月 2 日"],
    ["2026-01-10T12:00:00", "1 月 10 日"],
    ["2026-03-31T12:00:00", "3 月 31 日"],
  ])("%s → %s", (iso, expected) => {
    expect(dateStamp(taipei(iso))).toBe(expected);
  });

  it("凌晨兩點前算前一天（與日誌邏輯日一致）", () => {
    expect(dateStamp(taipei("2026-10-09T01:30:00"))).toBe("10 月 8 日");
  });
});
