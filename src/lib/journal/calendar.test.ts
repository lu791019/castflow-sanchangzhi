import { describe, expect, it } from "vitest";
import { currentMonth, parseMonth, summarizeByDay, totalsOf } from "./calendar";
import { fromTaipei } from "./time";
import type { JournalStatus, Venue } from "./types";

function entry(id: string, iso: string, venue: Venue, status: JournalStatus = "recorded") {
  return { id, experienced_at: iso, venue, status };
}

describe("parseMonth", () => {
  it("台北月界（UTC 前一天 16:00）", () => {
    const range = parseMonth("2026-10");
    expect(range?.start.toISOString()).toBe("2026-09-30T16:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(range?.month).toBe("2026-10");
  });

  it("12 月跨年", () => {
    expect(parseMonth("2026-12")?.end.toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });

  it.each(["2026-13", "2026-00", "2026-1", "abc", "", null, undefined])("格式錯 %s → null", (value) => {
    expect(parseMonth(value)).toBeNull();
  });

  it("currentMonth 用台北日期", () => {
    expect(currentMonth(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11");
  });
});

describe("summarizeByDay", () => {
  it("依台北日曆日彙總、計數各狀態、場域去重、日期排序", () => {
    const days = summarizeByDay([
      entry("c", fromTaipei(2026, 10, 9, 21).toISOString(), "home", "said"),
      entry("a", fromTaipei(2026, 10, 7, 21).toISOString(), "cinema"),
      entry("b", fromTaipei(2026, 10, 7, 23).toISOString(), "cinema", "skipped"),
      entry("d", fromTaipei(2026, 10, 7, 8).toISOString(), "commute"),
    ]);
    expect(days).toEqual([
      {
        date: "2026-10-07",
        count: 3,
        said: 0,
        recorded: 2,
        skipped: 1,
        planned: 0,
        venues: ["cinema", "commute"],
        entryIds: ["a", "b", "d"],
      },
      { date: "2026-10-09", count: 1, said: 1, recorded: 0, skipped: 0, planned: 0, venues: ["home"], entryIds: ["c"] },
    ]);
  });

  it("UTC 跨日但台北同日 → 同一格", () => {
    const days = summarizeByDay([
      entry("a", "2026-10-07T15:30:00Z", "home"), // 台北 10/7 23:30
      entry("b", "2026-10-06T17:00:00Z", "home"), // 台北 10/7 01:00
    ]);
    expect(days.map((d) => [d.date, d.count])).toEqual([["2026-10-07", 2]]);
  });

  it("空陣列", () => {
    expect(summarizeByDay([])).toEqual([]);
    expect(totalsOf([])).toEqual({ count: 0, said: 0, recorded: 0, skipped: 0, activeDays: 0 });
  });

  it("totalsOf 加總", () => {
    const days = summarizeByDay([
      entry("a", fromTaipei(2026, 10, 1, 20).toISOString(), "home", "said"),
      entry("b", fromTaipei(2026, 10, 2, 20).toISOString(), "live"),
      entry("c", fromTaipei(2026, 10, 2, 21).toISOString(), "live", "skipped"),
    ]);
    expect(totalsOf(days)).toEqual({ count: 3, said: 1, recorded: 1, skipped: 1, activeDays: 2 });
  });
});
