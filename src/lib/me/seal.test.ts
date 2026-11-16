import { describe, expect, it } from "vitest";
import { sealGlyph, sealShape } from "@/lib/seal/seal";
import { sealFor, SEAL_SHAPE_COUNT } from "./seal";

describe("sealFor", () => {
  it("空字串沒有印章", () => {
    expect(sealFor("  ")).toBeNull();
  });

  it("同一個筆名永遠得到同一個印章", () => {
    expect(sealFor("林小晴")).toEqual(sealFor("林小晴"));
  });

  it("形狀落在 0–7", () => {
    for (const name of ["林小晴", "Kai", "阿哲", "晚安", "x"]) {
      const seal = sealFor(name);
      expect(seal?.shape).toBeGreaterThanOrEqual(0);
      expect(seal?.shape).toBeLessThan(SEAL_SHAPE_COUNT);
    }
  });

  it("形狀與印文跟全站 <Seal> 同一套規則（UX-13）", () => {
    for (const name of ["林小晴", "kai", "阿哲", "晚安", "體驗jhdtg"]) {
      const seal = sealFor(name);
      expect(seal?.shape).toBe(sealShape(name));
      if (seal && seal.shape !== 7) expect(seal.chars).toEqual([sealGlyph(name)]);
    }
  });

  it("四分格刻前兩字：上列字一、下列字二（同 <Seal>）", () => {
    const name = ["甲乙", "丙丁", "戊己", "庚辛", "壬癸", "子丑", "寅卯", "辰巳", "午未", "申酉", "戌亥"].find(
      (candidate) => sealFor(candidate)?.shape === 7,
    );
    expect(name).toBeDefined();
    const seal = sealFor(name as string);
    const [a, b] = Array.from(name as string);
    expect(seal?.chars).toEqual([a, a, b, b]);
  });

  it("emoji 等多碼位字元以 code point 計", () => {
    const seal = sealFor("🎬好");
    expect(seal?.chars).toContain("🎬");
  });
});
