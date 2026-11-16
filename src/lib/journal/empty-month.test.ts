import { describe, expect, it } from "vitest";
import { emptyMonthCopy, emptyMonthPrefill, monthTense } from "./empty-month";

describe("monthTense（日誌空月份：過去／本月／未來）", () => {
  it("跟本月比", () => {
    expect(monthTense("2026-09", "2026-10")).toBe("past");
    expect(monthTense("2025-12", "2026-10")).toBe("past");
    expect(monthTense("2026-10", "2026-10")).toBe("current");
    expect(monthTense("2026-11", "2026-10")).toBe("future");
    expect(monthTense("2027-01", "2026-10")).toBe("future");
  });
});

describe("emptyMonthCopy（UX-24）", () => {
  it("過去月份不寫「從今晚開始」：這個月沒有紀錄＋補記", () => {
    const copy = emptyMonthCopy("past");
    expect(copy.title.join("")).toContain("這個月沒有紀錄");
    expect(copy.title.join("") + copy.body).not.toContain("今晚");
    expect(copy.action).toBe("補記一筆");
  });

  it("未來月份是排一場的語氣", () => {
    const copy = emptyMonthCopy("future");
    expect(copy.title.join("")).not.toContain("今晚");
    expect(copy.body).toContain("排進行程");
    expect(copy.action).toBe("排一場");
  });

  it("本月維持原文案", () => {
    const copy = emptyMonthCopy("current");
    expect(copy.title).toEqual(["這個月的第一筆，", "從今晚開始。"]);
    expect(copy.action).toBe("記第一筆");
  });
});

describe("emptyMonthPrefill（按鈕打開 sheet 的預填）", () => {
  it("過去：切到選日期時間、日期留給人選、標成補記", () => {
    expect(emptyMonthPrefill("past")).toEqual({ when: "custom", custom: "", intent: "backfill" });
  });

  it("未來：切到選日期時間（排行程模式）", () => {
    expect(emptyMonthPrefill("future")).toEqual({ when: "custom", custom: "" });
  });

  it("本月：不預填（維持「剛剛」）", () => {
    expect(emptyMonthPrefill("current")).toBeUndefined();
  });
});
