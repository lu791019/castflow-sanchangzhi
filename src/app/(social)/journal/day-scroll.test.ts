import { describe, expect, it } from "vitest";
import type { JournalViewEntry } from "@/lib/journal/view";
import { dayAnchorId, latestEntryId, scrollBehaviorFor, shouldScrollToDay } from "./day-scroll";

function entry(id: string, experiencedAt: string, status: JournalViewEntry["status"] = "recorded"): JournalViewEntry {
  return { id, experiencedAt, venue: "cinema", status, companions: null, titleFallback: null, work: null, article: null };
}

describe("shouldScrollToDay（UX-05／UX-06）", () => {
  it("選了新的一天 → 捲過去", () => {
    expect(shouldScrollToDay(null, "2026-10-14")).toBe(true);
    expect(shouldScrollToDay("2026-10-13", "2026-10-14")).toBe(true);
  });

  it("直接帶 day 打開（接下來那筆、分享連結）也捲", () => {
    expect(shouldScrollToDay(undefined, "2026-10-17")).toBe(true);
  });

  it("收起或沒變 → 不動", () => {
    expect(shouldScrollToDay("2026-10-14", null)).toBe(false);
    expect(shouldScrollToDay("2026-10-14", "2026-10-14")).toBe(false);
    expect(shouldScrollToDay(undefined, null)).toBe(false);
  });
});

describe("scrollBehaviorFor", () => {
  it("減少動態時不做平滑捲動", () => {
    expect(scrollBehaviorFor(true)).toBe("auto");
    expect(scrollBehaviorFor(false)).toBe("smooth");
  });
});

describe("dayAnchorId", () => {
  it("用日期鍵組 id", () => {
    expect(dayAnchorId("2026-10-14")).toBe("journal-day-2026-10-14");
  });
});

describe("latestEntryId（導覽 4d 指剛記的那筆）", () => {
  it("取發生時間最新、不含計畫中", () => {
    const entries = [
      entry("a", "2026-10-12T12:00:00.000Z"),
      entry("b", "2026-10-14T03:00:00.000Z"),
      entry("plan", "2026-10-20T11:00:00.000Z", "planned"),
      entry("c", "2026-10-13T12:00:00.000Z", "skipped"),
    ];
    expect(latestEntryId(entries)).toBe("b");
  });

  it("沒有紀錄回 null", () => {
    expect(latestEntryId([])).toBeNull();
    expect(latestEntryId([entry("plan", "2026-10-20T11:00:00.000Z", "planned")])).toBeNull();
  });
});
