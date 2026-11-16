import { describe, expect, it } from "vitest";
import { dayPrefill, DAY_PREFILL_TIME } from "./day-prefill";

describe("dayPrefill（月曆日期格記一筆）", () => {
  it("過去的日子：切到選日期時間，預填當天晚上 8 點", () => {
    expect(dayPrefill("2026-10-03", "2026-10-13")).toEqual({ when: "custom", custom: "2026-10-03T20:00" });
  });

  it("未來的日子同樣預填（sheet 會自動變成排進行程）", () => {
    expect(dayPrefill("2026-10-20", "2026-10-13")).toEqual({ when: "custom", custom: `2026-10-20T${DAY_PREFILL_TIME}` });
  });

  it("今天不預填：維持「剛剛」，免得下午點今天被當成晚上的計畫", () => {
    expect(dayPrefill("2026-10-13", "2026-10-13")).toBeUndefined();
  });

  it("不合法的日期鍵不預填", () => {
    expect(dayPrefill("2026-1-3", "2026-10-13")).toBeUndefined();
    expect(dayPrefill("", "2026-10-13")).toBeUndefined();
  });
});
