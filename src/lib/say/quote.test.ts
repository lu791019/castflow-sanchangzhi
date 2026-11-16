import { describe, expect, it } from "vitest";
import { MAX_QUOTE_CHARS, normalizeQuoteParam, quotePrefillText } from "./quote";

describe("normalizeQuoteParam", () => {
  it("缺值或空白 → null", () => {
    expect(normalizeQuoteParam(undefined)).toBeNull();
    expect(normalizeQuoteParam("   ")).toBeNull();
  });

  it("陣列取第一個", () => {
    expect(normalizeQuoteParam(["第一句", "第二句"])).toBe("第一句");
  });

  it("去頭尾空白、壓縮內部連續空白與換行、移除控制字元", () => {
    expect(normalizeQuoteParam("  她把鑰匙\n\n放回信箱\u0007 ")).toBe("她把鑰匙 放回信箱");
  });

  it("去掉使用者已帶的外層引號，避免「「…」」", () => {
    expect(normalizeQuoteParam("「沒有回頭。」")).toBe("沒有回頭。");
    expect(normalizeQuoteParam("\"no way back\"")).toBe("no way back");
  });

  it("超過上限截斷並加刪節號", () => {
    const long = "字".repeat(MAX_QUOTE_CHARS + 20);
    const result = normalizeQuoteParam(long) as string;
    expect(Array.from(result)).toHaveLength(MAX_QUOTE_CHARS + 1);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("quotePrefillText", () => {
  it("包成引句並留兩個換行給使用者接著說", () => {
    expect(quotePrefillText("沒有回頭。")).toBe("「沒有回頭。」\n\n");
  });
});
