import { describe, expect, it } from "vitest";
import { parseLiveDates } from "./dates";

const REF = "2026-10-10";

describe("parseLiveDates", () => {
  it("空白回 null（之後用記一筆的日子）", () => {
    expect(parseLiveDates("", REF)).toEqual({ ok: true, value: null });
    expect(parseLiveDates("   ", REF)).toEqual({ ok: true, value: null });
  });

  it("單日：各種寫法，缺年份用記錄那天的年份", () => {
    for (const text of ["10.09", "10/9", "10-09", "10月9日", "2026.10.09", "2026/10/9", "2026-10-09", "2026年10月9日"]) {
      expect(parseLiveDates(text, REF)).toEqual({ ok: true, value: { start: "2026-10-09", end: null } });
    }
  });

  it("區間：– — - ~ ～ 至 到 都算", () => {
    for (const text of ["10.09 – 10.10", "10.09—10.10", "10.09-10.10", "10/9~10/10", "10.09～10.10", "10.09 至 10.10", "10月9日到10月10日"]) {
      expect(parseLiveDates(text, REF)).toEqual({ ok: true, value: { start: "2026-10-09", end: "2026-10-10" } });
    }
  });

  it("展期：起日帶年份、迄日不帶時沿用起日年份", () => {
    expect(parseLiveDates("2026.09.12 – 11.30", REF)).toEqual({
      ok: true,
      value: { start: "2026-09-12", end: "2026-11-30" },
    });
  });

  it("帶星期註記也看得懂", () => {
    expect(parseLiveDates("2026.10.09（五）– 10.10（六）", REF)).toEqual({
      ok: true,
      value: { start: "2026-10-09", end: "2026-10-10" },
    });
  });

  it("跨年：迄日早於起日 → 迄日進一年", () => {
    expect(parseLiveDates("12.20 – 1.05", "2026-12-25")).toEqual({
      ok: true,
      value: { start: "2026-12-20", end: "2027-01-05" },
    });
  });

  it("一月記去年十二月的場：缺年份且離記錄日超過半年往前推一年", () => {
    expect(parseLiveDates("12.31", "2027-01-02")).toEqual({ ok: true, value: { start: "2026-12-31", end: null } });
  });

  it("同一天的區間收成單日", () => {
    expect(parseLiveDates("10.09 – 10.09", REF)).toEqual({ ok: true, value: { start: "2026-10-09", end: null } });
  });

  it("看不懂或不合法回錯誤", () => {
    expect(parseLiveDates("下週六", REF).ok).toBe(false);
    expect(parseLiveDates("13.01", REF).ok).toBe(false);
    expect(parseLiveDates("2.30", REF).ok).toBe(false);
    expect(parseLiveDates("10.01 – 10.02 – 10.03", REF).ok).toBe(false);
    expect(parseLiveDates("2026.10.10 – 2026.10.01", REF).ok).toBe(false);
    expect(parseLiveDates("2025.01.01 – 2026.10.01", REF).ok).toBe(false);
    expect(parseLiveDates("1.1".repeat(60), REF).ok).toBe(false);
  });
});
