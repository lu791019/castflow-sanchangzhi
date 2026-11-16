import { describe, expect, it } from "vitest";
import {
  LETTER_LIMIT,
  countChars,
  gridRows,
  overLimitMessage,
  validateLetterText,
} from "./rules";

describe("countChars", () => {
  it("以字元計（emoji、罕用字各算一字）", () => {
    expect(countChars("")).toBe(0);
    expect(countChars("想說的話")).toBe(4);
    expect(countChars("𠮷野家🙂")).toBe(4);
  });
});

describe("validateLetterText", () => {
  it("去頭尾空白後 1–140 字通過", () => {
    expect(validateLetterText("  謝謝妳寫下來。 ")).toEqual({ ok: true, value: "謝謝妳寫下來。" });
    expect(validateLetterText("字".repeat(LETTER_LIMIT))).toMatchObject({ ok: true });
  });

  it("空白、非字串、超過 140 字擋下", () => {
    expect(validateLetterText("   ")).toMatchObject({ ok: false });
    expect(validateLetterText(null)).toMatchObject({ ok: false });
    expect(validateLetterText(42)).toMatchObject({ ok: false });
    expect(validateLetterText("字".repeat(LETTER_LIMIT + 1))).toEqual({
      ok: false,
      error: "多了 1 個字，刪掉一些再寄。",
    });
  });

  it("控制字元（換行以外）擋下；換行保留", () => {
    expect(validateLetterText("一\u0000二")).toMatchObject({ ok: false });
    expect(validateLetterText("第一行\n第二行")).toEqual({ ok: true, value: "第一行\n第二行" });
  });
});

describe("overLimitMessage", () => {
  it("多出的字數用阿拉伯數字", () => {
    expect(overLimitMessage(143)).toBe("多了 3 個字，刪掉一些再寄。");
    expect(overLimitMessage(152)).toBe("多了 12 個字，刪掉一些再寄。");
  });
});

describe("gridRows（稿紙格，一列 11 格）", () => {
  it("預設三行，跟著字數長，最多十三行", () => {
    expect(gridRows(0)).toBe(3);
    expect(gridRows(33)).toBe(3);
    expect(gridRows(34)).toBe(4);
    expect(gridRows(60)).toBe(6);
    expect(gridRows(143)).toBe(13);
    expect(gridRows(300)).toBe(13);
  });
});
