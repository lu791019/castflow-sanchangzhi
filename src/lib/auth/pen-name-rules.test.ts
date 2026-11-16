import { describe, expect, it } from "vitest";
import { PEN_NAME_MAX_LENGTH, validatePenName } from "./pen-name-rules";

describe("validatePenName", () => {
  it("去頭尾空白後回傳", () => {
    expect(validatePenName("  散場的人 ")).toEqual({ ok: true, value: "散場的人" });
  });

  it("中文以字數計，20 字可、21 字不可", () => {
    expect(validatePenName("字".repeat(PEN_NAME_MAX_LENGTH)).ok).toBe(true);
    const tooLong = validatePenName("字".repeat(PEN_NAME_MAX_LENGTH + 1));
    expect(tooLong).toEqual({ ok: false, error: "筆名最多 20 個字" });
  });

  it("emoji 以一個字計", () => {
    expect(validatePenName("🎬".repeat(20)).ok).toBe(true);
  });

  it.each([undefined, null, 123, "", "   "])("空值 %s 不可", (value) => {
    expect(validatePenName(value)).toEqual({ ok: false, error: "請取一個筆名" });
  });

  it("不可含換行或控制字元", () => {
    expect(validatePenName("a\nb")).toEqual({ ok: false, error: "筆名不能有換行或特殊控制字元" });
  });
});
