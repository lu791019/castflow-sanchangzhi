import { describe, expect, it } from "vitest";
import { wantsRepeatCheck, REPEAT_WINDOW_MS, repeatPrompt, repeatSince } from "./repeat";

const now = new Date("2026-10-14T12:00:00Z");

describe("repeatSince（同一部作品 2 小時內再記，UX-26）", () => {
  it("往前推 2 小時", () => {
    expect(REPEAT_WINDOW_MS).toBe(2 * 60 * 60 * 1000);
    expect(repeatSince(now).toISOString()).toBe("2026-10-14T10:00:00.000Z");
  });
});

describe("wantsRepeatCheck（sheet 第一次送出帶 checkRepeat: true；確認後不帶；其他 API 呼叫不受影響）", () => {
  it("只認布林 true", () => {
    expect(wantsRepeatCheck({ checkRepeat: true })).toBe(true);
    expect(wantsRepeatCheck({ checkRepeat: "true" })).toBe(false);
    expect(wantsRepeatCheck({})).toBe(false);
    expect(wantsRepeatCheck(null)).toBe(false);
  });
});

describe("repeatPrompt（sheet 內確認的句子）", () => {
  it("幾分鐘前、作品用《》、場外用「」", () => {
    expect(repeatPrompt({ title: "你的名字", live: false, loggedAt: new Date("2026-10-14T11:48:00Z"), now })).toBe(
      "12 分鐘前記過《你的名字》了，要再記一筆嗎？",
    );
    expect(repeatPrompt({ title: "草東沒有派對", live: true, loggedAt: new Date("2026-10-14T10:30:00Z"), now })).toBe(
      "1 小時前記過「草東沒有派對」了，要再記一筆嗎？",
    );
  });

  it("不到一分鐘寫「剛剛」", () => {
    expect(repeatPrompt({ title: "海街日記", live: false, loggedAt: new Date("2026-10-14T11:59:40Z"), now })).toBe(
      "剛剛記過《海街日記》了，要再記一筆嗎？",
    );
  });
});
