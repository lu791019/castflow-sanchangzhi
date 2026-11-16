import { describe, expect, it } from "vitest";
import { fnv1a, sealGlyph, sealOf, sealShape, SEAL_SHAPE_NAMES } from "./seal";

describe("fnv1a", () => {
  it("同一個筆名永遠同一個雜湊（以 code point 計，中英文皆可）", () => {
    expect(fnv1a("林小晴")).toBe(fnv1a("林小晴"));
    expect(fnv1a("")).toBe(2166136261);
    expect(fnv1a("a")).toBe(0xe40c292c);
  });
});

describe("sealGlyph（印文）", () => {
  it.each([
    ["阿哲", "哲"],
    ["小魚", "魚"],
    ["老陳", "陳"],
    ["林小晴", "晴"],
    ["蘇蘇", "蘇"],
    ["Kai", "K"],
    ["mina", "M"],
    ["雨", "雨"],
  ])("%s → %s", (pen, glyph) => {
    expect(sealGlyph(pen)).toBe(glyph);
  });
});

describe("sealShape / sealOf", () => {
  it("外形＝FNV-1a mod 8，八種都有名字", () => {
    expect(sealShape("林小晴")).toBe(fnv1a("林小晴") % 8);
    expect(SEAL_SHAPE_NAMES).toHaveLength(8);
  });

  it("尺寸對應線寬 1／1.5／2px 與字級", () => {
    expect(sealOf("林小晴", 24)).toMatchObject({ strokePx: 1, glyphPx: 12, quadPx: 11 });
    expect(sealOf("林小晴", 40)).toMatchObject({ strokePx: 1.5, glyphPx: 22, quadPx: 15 });
    expect(sealOf("林小晴", 64)).toMatchObject({ strokePx: 2, glyphPx: 30, quadPx: 22 });
  });

  it("四分格取前兩字；只有一字時重複；白文為實底", () => {
    const quadName = findName((pen) => sealShape(pen) === 7);
    expect(sealOf(quadName, 40).quad).toEqual([[...quadName][0], [...quadName][1]]);
    expect(sealOf("雨", 40).quad === null || sealOf("雨", 40).quad?.[0] === sealOf("雨", 40).quad?.[1]).toBe(true);
    const whiteName = findName((pen) => sealShape(pen) === 4);
    expect(sealOf(whiteName, 40)).toMatchObject({ filled: true, quad: null });
  });

  it("可換印文用字，但只限筆名裡的字", () => {
    expect(sealOf("林小晴", 40, "林").glyph).toBe("林");
    expect(sealOf("林小晴", 40, "王").glyph).toBe("晴");
  });

  it("空筆名不炸：用「？」", () => {
    expect(sealOf("", 24).glyph).toBe("？");
  });
});

function findName(match: (pen: string) => boolean): string {
  const pool = "林小晴阿哲魚寬蘇陳呂雨青布晚安王大明美玲志豪家文";
  for (const a of pool) for (const b of pool) if (match(a + b)) return a + b;
  throw new Error("找不到樣本");
}
