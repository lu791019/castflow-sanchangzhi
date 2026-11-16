import { describe, expect, it } from "vitest";
import { countMeaningfulChars, isTooShortToGenerate, MIN_MEANINGFUL_CHARS } from "./meaningful";

describe("countMeaningfulChars", () => {
  it("只算文字與數字，不算標點、空白、符號", () => {
    expect(countMeaningfulChars(".")).toBe(0);
    expect(countMeaningfulChars("  …… ！？ ")).toBe(0);
    expect(countMeaningfulChars("燈亮的時候，我哭了。")).toBe(8);
    expect(countMeaningfulChars("I cried 2 times")).toBe(12);
  });
});

describe("isTooShortToGenerate", () => {
  it(`少於 ${MIN_MEANINGFUL_CHARS} 個有效字就不送生成`, () => {
    expect(MIN_MEANINGFUL_CHARS).toBe(10);
    expect(isTooShortToGenerate(".")).toBe(true);
    expect(isTooShortToGenerate("")).toBe(true);
    expect(isTooShortToGenerate(null)).toBe(true);
    expect(isTooShortToGenerate("很好看，真的。")).toBe(true);
    expect(isTooShortToGenerate("燈亮的時候我哭了很久很久")).toBe(false);
  });
});
