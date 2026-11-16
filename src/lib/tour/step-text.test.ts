import { describe, expect, it } from "vitest";
import { STEPS, stepText } from "./steps";

describe("stepText：寬螢幕改指刊頭「記一筆」", () => {
  it("窄版一律用預設文案", () => {
    expect(stepText(STEPS["log-center"], false)).toEqual({ title: "記一筆", body: "點一下中央圓鈕。" });
    expect(stepText(STEPS["plan-center"], false).title).toBe("中央圓鈕");
  });

  it("寬版有 wide 就逐欄替換，沒給的欄位沿用預設", () => {
    expect(stepText(STEPS["log-center"], true)).toEqual({ title: "記一筆", body: "點一下右上角的「記一筆」。" });
    expect(stepText(STEPS["plan-center"], true).title).toBe("記一筆");
    expect(stepText(STEPS["plan-center"], true).body).toContain("右上角的「記一筆」");
  });

  it("沒有 wide 的步驟寬窄相同；日誌那兩步不寫方位", () => {
    expect(stepText(STEPS.goal, true)).toEqual(stepText(STEPS.goal, false));
    for (const id of ["plan-journal", "log-journal"] as const) {
      expect(stepText(STEPS[id], true).body).toBe("點「日誌」看看。");
      expect(stepText(STEPS[id], false).body).toBe("點「日誌」看看。");
    }
  });
});
