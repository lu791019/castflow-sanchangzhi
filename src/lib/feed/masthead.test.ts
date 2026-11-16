import { describe, expect, it } from "vitest";
import { mastheadIssueLine } from "./masthead";

describe("mastheadIssueLine", () => {
  it("桌機刊頭中央：刊名・期號・日期 星期", () => {
    // 2026-10-10 晚上（台北）＝一年第 283 天
    expect(mastheadIssueLine(new Date("2026-10-10T20:00:00+08:00"))).toBe("散場之後・第 0283 號・10 月 10 日 週六");
  });
});
