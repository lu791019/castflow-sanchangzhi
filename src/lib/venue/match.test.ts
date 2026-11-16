import { describe, expect, it } from "vitest";
import { dayGap, pickProgramme, programmeRange, type ProgrammeCandidate } from "./match";

const work = (over: Partial<ProgrammeCandidate>): ProgrammeCandidate => ({
  id: "w1",
  kind: "live",
  live_key: "島嶼夜歌草地音樂會",
  event_date: "2026-10-09",
  event_end_date: "2026-10-10",
  issue_no: 31,
  ...over,
});

describe("programmeRange", () => {
  it("沒有迄日視為單日；沒有起日回 null", () => {
    expect(programmeRange({ event_date: "2026-10-09", event_end_date: null })).toEqual({ start: "2026-10-09", end: "2026-10-09" });
    expect(programmeRange({ event_date: null, event_end_date: null })).toBeNull();
  });
});

describe("pickProgramme：同類型＋同名（正規化）＋日期重疊 → 同一本場刊", () => {
  const input = { kind: "live" as const, key: "島嶼夜歌草地音樂會", range: { start: "2026-10-10", end: "2026-10-10" } };

  it("命中日期區間內的既有場刊", () => {
    expect(pickProgramme([work({})], input)?.id).toBe("w1");
  });

  it("類型不同不合併（演出 vs 展覽）", () => {
    expect(pickProgramme([work({ kind: "exhibition" })], input)).toBeNull();
  });

  it("名稱鍵不同不合併", () => {
    expect(pickProgramme([work({ live_key: "島嶼夜歌" })], input)).toBeNull();
  });

  it("日期不重疊不合併（同名巡演的另一場）", () => {
    expect(pickProgramme([work({ event_date: "2026-11-01", event_end_date: null })], input)).toBeNull();
  });

  it("沒有日期的舊作品不參與比對", () => {
    expect(pickProgramme([work({ event_date: null, event_end_date: null })], input)).toBeNull();
  });

  it("多本都命中時取期號最早的（第一位記下的人建的）", () => {
    const picked = pickProgramme(
      [work({ id: "late", issue_no: 40 }), work({ id: "early", issue_no: 12 })],
      input,
    );
    expect(picked?.id).toBe("early");
  });
});

describe("dayGap：兩段日期之間隔幾天（重疊為 0）", () => {
  it("重疊或相接同一天為 0；隔一天為 1；先後順序不影響", () => {
    expect(dayGap({ start: "2026-10-09", end: "2026-10-10" }, { start: "2026-10-10", end: "2026-10-10" })).toBe(0);
    expect(dayGap({ start: "2026-10-09", end: "2026-10-09" }, { start: "2026-10-10", end: "2026-10-10" })).toBe(1);
    expect(dayGap({ start: "2026-10-10", end: "2026-10-10" }, { start: "2026-10-09", end: "2026-10-09" })).toBe(1);
    expect(dayGap({ start: "2026-12-31", end: "2026-12-31" }, { start: "2027-03-31", end: "2027-03-31" })).toBe(90);
  });
});

describe("pickProgramme：演出相鄰一天、展覽 90 天內也算同一本（Dex 10/11 拍板）", () => {
  it("多日音樂祭：第一晚 10.09、第二晚 10.10 各寫單日 → 同一本", () => {
    const night1 = work({ event_date: "2026-10-09", event_end_date: null });
    expect(pickProgramme([night1], { kind: "live", key: "島嶼夜歌草地音樂會", range: { start: "2026-10-10", end: "2026-10-10" } })?.id).toBe("w1");
  });

  it("演出隔兩天以上 → 分開（巡演另一場）", () => {
    const night1 = work({ event_date: "2026-10-09", event_end_date: null });
    expect(pickProgramme([night1], { kind: "live", key: "島嶼夜歌草地音樂會", range: { start: "2026-10-11", end: "2026-10-11" } })).toBeNull();
  });

  it("展覽同名、來訪日相差 90 天內 → 同一本；超過 90 天 → 分開", () => {
    const visit = work({ kind: "exhibition", live_key: "光的抄寫", event_date: "2026-08-01", event_end_date: null });
    const query = (day: string) => ({ kind: "exhibition" as const, key: "光的抄寫", range: { start: day, end: day } });
    expect(pickProgramme([visit], query("2026-10-30"))?.id).toBe("w1");
    expect(pickProgramme([visit], query("2026-10-31"))).toBeNull();
  });
});
