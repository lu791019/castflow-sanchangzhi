import { describe, expect, it } from "vitest";
import { decide, outcomeTarget, pageOf, progressOf, resumeStep } from "./machine";
import { ROUTES, STEPS } from "./steps";

describe("pageOf", () => {
  it("認得導覽會出現的頁面", () => {
    expect(pageOf("/before")).toBe("before");
    expect(pageOf("/journal")).toBe("journal");
    expect(pageOf("/journal/")).toBe("journal");
    expect(pageOf("/")).toBe("feed");
    expect(pageOf("/s/abc123")).toBe("article");
    expect(pageOf("/say")).toBe("say");
    expect(pageOf("/notifications/enable")).toBe("notify");
  });

  it("其他頁（含日誌的子頁）不放導覽", () => {
    expect(pageOf("/journal/new")).toBeNull();
    expect(pageOf("/me")).toBeNull();
    expect(pageOf("/s")).toBeNull();
    expect(pageOf("/works/movie-1")).toBeNull();
  });
});

describe("progressOf", () => {
  it("目標句與分岔卡算在七步裡", () => {
    expect(progressOf("goal")).toEqual({ index: 1, total: 7 });
    expect(progressOf("fork")).toEqual({ index: 2, total: 7 });
  });

  it("兩條路線各七步", () => {
    expect(progressOf("plan-pick")).toEqual({ index: 3, total: 7 });
    expect(progressOf("plan-center")).toEqual({ index: 7, total: 7 });
    expect(progressOf("log-latest")).toEqual({ index: 7, total: 7 });
  });

  it("中途去說一段：六步結束", () => {
    expect(progressOf("log-say")).toEqual({ index: 6, total: 6 });
  });

  it("訪客三步", () => {
    expect(progressOf("guest-masthead")).toEqual({ index: 1, total: 3 });
    expect(progressOf("guest-cta")).toEqual({ index: 3, total: 3 });
  });
});

describe("decide", () => {
  const base = { webdriver: false, forced: false };

  it("登入者第一次到散場之前：自動開始", () => {
    expect(decide({ ...base, flow: "member", stored: null, pathname: "/before" })).toEqual({ kind: "start", step: "goal" });
  });

  it("訪客第一次看目錄：自動開始", () => {
    expect(decide({ ...base, flow: "guest", stored: null, pathname: "/" })).toEqual({ kind: "start", step: "guest-masthead" });
  });

  it("沒播過但不在起點頁：不播", () => {
    expect(decide({ ...base, flow: "member", stored: null, pathname: "/journal" })).toEqual({ kind: "idle" });
    expect(decide({ ...base, flow: "guest", stored: null, pathname: "/s/abc" })).toEqual({ kind: "idle" });
  });

  it("看完或略過就不再自動播", () => {
    expect(decide({ ...base, flow: "member", stored: { status: "done" }, pathname: "/before" })).toEqual({ kind: "idle" });
  });

  it("Playwright 下不自動播，除非 force", () => {
    expect(decide({ ...base, webdriver: true, flow: "member", stored: null, pathname: "/before" })).toEqual({ kind: "idle" });
    expect(decide({ webdriver: true, forced: true, flow: "member", stored: null, pathname: "/before" })).toEqual({
      kind: "start",
      step: "goal",
    });
  });

  it("進行中：到了那一步的頁面就接著播", () => {
    const stored = { status: "active", step: "plan-upcoming", explicit: false } as const;
    expect(decide({ ...base, flow: "member", stored, pathname: "/journal" })).toEqual({ kind: "show", step: "plan-upcoming" });
    expect(decide({ ...base, flow: "member", stored, pathname: "/before" })).toEqual({ kind: "idle" });
  });

  it("自己按重播的：Playwright 下也接著播", () => {
    const stored = { status: "active", step: "goal", explicit: true } as const;
    expect(decide({ ...base, webdriver: true, flow: "member", stored, pathname: "/before" })).toEqual({ kind: "show", step: "goal" });
  });

  it("別人的路線狀態不播（登入者讀到訪客步驟）", () => {
    const stored = { status: "active", step: "guest-first", explicit: false } as const;
    expect(decide({ ...base, flow: "member", stored, pathname: "/" })).toEqual({ kind: "idle" });
  });
});

describe("resumeStep", () => {
  it("sheet 裡的步驟，sheet 沒開就退回打開 sheet 那一步", () => {
    expect(resumeStep("plan-submit", false)).toBe("plan-pick");
    expect(resumeStep("log-actions", false)).toBe("log-center");
    expect(resumeStep("plan-submit", true)).toBe("plan-submit");
  });

  it("不在 sheet 裡的步驟照舊", () => {
    expect(resumeStep("plan-upcoming", false)).toBe("plan-upcoming");
  });
});

describe("outcomeTarget", () => {
  it("點了被照亮的元素 → 下一步", () => {
    expect(outcomeTarget("plan-pick", { type: "click" })).toBe("plan-submit");
    expect(outcomeTarget("guest-first", { type: "click" })).toBe("guest-cta");
  });

  it("送出後 toast 出現 → 去日誌那一步", () => {
    expect(outcomeTarget("plan-submit", { type: "appear", selector: '[data-tour="log-toast"]' })).toBe("plan-journal");
    expect(outcomeTarget("log-actions", { type: "appear", selector: '[data-tour="log-toast"]' })).toBe("log-journal");
  });

  it("第一次記下被帶去通知權限引導 → 接日誌那一步", () => {
    expect(outcomeTarget("plan-submit", { type: "page", page: "notify" })).toBe("plan-upcoming");
    expect(outcomeTarget("log-actions", { type: "page", page: "notify" })).toBe("log-latest");
  });

  it("按了現在就想說、換到說一段 → 結尾卡", () => {
    expect(outcomeTarget("log-actions", { type: "page", page: "say" })).toBe("log-say");
  });

  it("說明步驟與不相干的事件不前進", () => {
    expect(outcomeTarget("goal", { type: "click" })).toBeNull();
    expect(outcomeTarget("plan-pick", { type: "page", page: "say" })).toBeNull();
  });
});

describe("步驟定義", () => {
  it("每條路線的步驟都存在、頁面一致", () => {
    for (const route of Object.values(ROUTES)) {
      for (const id of route) expect(STEPS[id].id).toBe(id);
    }
  });

  it("動作步驟沒有「下一步」：一定有完成條件", () => {
    for (const step of Object.values(STEPS)) {
      if (step.mode === "action") expect(step.outcomes.length).toBeGreaterThan(0);
    }
  });

  it("sheet 裡的步驟都能退回", () => {
    for (const step of Object.values(STEPS)) {
      if (step.inSheet) expect(step.resumeAs).toBeDefined();
    }
  });

  it("Q-54：文案不出現「只記不說」按鈕、圓鈕說明含打字", () => {
    const all = Object.values(STEPS).map((step) => `${step.title}${step.body}`).join("");
    expect(all).not.toContain("只記不說");
    expect(STEPS["plan-center"].body).toBe("按住說一段，或打字寫下來；不想寫也能只記。");
    expect(STEPS["log-actions"].body).toBe("想寫就寫，說的或打的都行；不想寫，直接記下就好。");
  });
});
