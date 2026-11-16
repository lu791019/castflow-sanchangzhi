import { describe, expect, it } from "vitest";
import {
  isScheduleLocked,
  parseTaipeiLocal,
  rescheduleSlots,
  toTaipeiLocal,
  validateReschedule,
} from "./schedule";

const NOW = new Date("2026-10-10T10:00:00Z"); // 台北 18:00

describe("rescheduleSlots", () => {
  it("傍晚：今晚 21:00、明天 8:00、後天 9:00", () => {
    expect(rescheduleSlots(NOW)).toEqual([
      { label: "今晚 21:00", iso: "2026-10-10T13:00:00.000Z" },
      { label: "明天 早上 8:00", iso: "2026-10-11T00:00:00.000Z" },
      { label: "10.12 早上 9:00", iso: "2026-10-12T01:00:00.000Z" },
    ]);
  });

  it("20:55 之後不給今晚", () => {
    const late = new Date("2026-10-10T12:55:00Z");
    expect(rescheduleSlots(late).map((slot) => slot.label)).toEqual(["明天 早上 8:00", "10.12 早上 9:00"]);
  });

  it("跨月", () => {
    const end = new Date("2026-10-30T10:00:00Z");
    expect(rescheduleSlots(end).at(-1)?.label).toBe("11.01 早上 9:00");
  });
});

describe("validateReschedule / isScheduleLocked", () => {
  it("10 分鐘內不行、90 天外不行", () => {
    expect(validateReschedule("2026-10-10T10:05:00Z", NOW).ok).toBe(false);
    expect(validateReschedule("2026-10-10T10:11:00Z", NOW)).toEqual({ ok: true, iso: "2026-10-10T10:11:00.000Z" });
    expect(validateReschedule("2027-02-10T10:00:00Z", NOW).ok).toBe(false);
    expect(validateReschedule("not a date", NOW).ok).toBe(false);
  });

  it("發佈前 10 分鐘鎖定", () => {
    expect(isScheduleLocked("2026-10-10T10:09:00Z", NOW)).toBe(true);
    expect(isScheduleLocked("2026-10-10T10:30:00Z", NOW)).toBe(false);
  });
});

describe("datetime-local 轉換（台北）", () => {
  it("來回轉換", () => {
    expect(parseTaipeiLocal("2026-10-12T09:00")).toBe("2026-10-12T01:00:00.000Z");
    expect(toTaipeiLocal("2026-10-12T01:00:00.000Z")).toBe("2026-10-12T09:00");
  });

  it("格式不符回 null", () => {
    expect(parseTaipeiLocal("2026-10-12 09:00")).toBeNull();
    expect(parseTaipeiLocal("2026-13-12T09:00")).toBeNull();
  });
});
