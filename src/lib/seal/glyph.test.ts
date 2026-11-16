import { describe, expect, it } from "vitest";
import { glyphChoices, parseSealGlyph, resolveGlyph } from "./glyph";

describe("glyphChoices：筆名中可當印文的字", () => {
  it("逐字去重，略過空白與標點", () => {
    expect(glyphChoices("林小晴")).toEqual(["林", "小", "晴"]);
    expect(glyphChoices("呂呂")).toEqual(["呂"]);
    expect(glyphChoices("晚安．Kai")).toEqual(["晚", "安", "K", "a", "i"]);
    expect(glyphChoices("  ")).toEqual([]);
  });
});

describe("parseSealGlyph：server 端驗證", () => {
  it("null／空字串＝回到依規則", () => {
    expect(parseSealGlyph(null, "林小晴")).toEqual({ ok: true, value: null });
    expect(parseSealGlyph("", "林小晴")).toEqual({ ok: true, value: null });
  });

  it("筆名中的字才收", () => {
    expect(parseSealGlyph("林", "林小晴")).toEqual({ ok: true, value: "林" });
    expect(parseSealGlyph("王", "林小晴").ok).toBe(false);
  });

  it("只能一個字、必須是文字、不收標點", () => {
    expect(parseSealGlyph("林小", "林小晴").ok).toBe(false);
    expect(parseSealGlyph(3, "林小晴").ok).toBe(false);
    expect(parseSealGlyph("．", "晚安．Kai").ok).toBe(false);
  });

  it("沒有筆名不能設", () => {
    expect(parseSealGlyph("林", "").ok).toBe(false);
  });
});

describe("resolveGlyph", () => {
  it("存的字已不在筆名裡（改過筆名）→ 視為依規則", () => {
    expect(resolveGlyph("林", "林小晴")).toBe("林");
    expect(resolveGlyph("林", "雨青")).toBeNull();
    expect(resolveGlyph(null, "雨青")).toBeNull();
  });
});
