import { describe, expect, it } from "vitest";
import {
  approxCharCount,
  estimateRemainingMinutes,
  formatClock,
  isLongTranscription,
  manuscriptCells,
} from "./waiting";

describe("estimateRemainingMinutes", () => {
  it("12:48 的錄音、剛送出：約 4 分鐘", () => {
    expect(estimateRemainingMinutes(768, 0)).toBe(4);
  });

  it("扣掉已經過的時間，最少 1 分鐘", () => {
    expect(estimateRemainingMinutes(768, 120)).toBe(2);
    expect(estimateRemainingMinutes(768, 9999)).toBe(1);
  });

  it("不知道長度回 null", () => {
    expect(estimateRemainingMinutes(null, 0)).toBeNull();
    expect(estimateRemainingMinutes(Infinity, 0)).toBeNull();
  });

  it("超過 2 分鐘才算長", () => {
    expect(isLongTranscription(3)).toBe(true);
    expect(isLongTranscription(2)).toBe(false);
    expect(isLongTranscription(null)).toBe(false);
  });
});

describe("formatClock / approxCharCount / manuscriptCells", () => {
  it("formatClock", () => {
    expect(formatClock(92)).toBe("1:32");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(0)).toBeNull();
  });

  it("approxCharCount", () => {
    expect(approxCharCount("一二 三")).toBe("約 3 字");
    expect(approxCharCount("字".repeat(384))).toBe("約 380 字");
  });

  it("manuscriptCells", () => {
    expect(manuscriptCells("燈亮的時候，\n我", 4)).toEqual(["燈", "亮", "的", "時"]);
    expect(manuscriptCells("", 4)).toEqual([]);
  });
});
