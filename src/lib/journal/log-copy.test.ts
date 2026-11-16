import { describe, expect, it } from "vitest";
import { logSheetCopy, logSubmitLabel } from "./log-copy";

describe("logSubmitLabel（記一筆主鈕跟著狀態走）", () => {
  const base = { isLive: false, hasSubject: true, hasPlace: true, hasTime: true, planned: false, planMode: false };

  it("一般記一筆：選好作品與地點 → 記下了；未選 → 提示", () => {
    expect(logSubmitLabel(base)).toBe("記下了");
    expect(logSubmitLabel({ ...base, hasPlace: false })).toBe("選作品與在哪裡");
    expect(logSubmitLabel({ ...base, isLive: true, hasSubject: false })).toBe("寫下演出名或展覽名");
  });

  it("未來時間 → 排進行程", () => {
    expect(logSubmitLabel({ ...base, planned: true })).toBe("排進行程");
    expect(logSubmitLabel({ ...base, isLive: true, planned: true })).toBe("排進行程");
  });

  it("從「排進行程」打開、還沒選日期 → 選一個日期時間（UX-11），不是停用的「記下了」", () => {
    expect(logSubmitLabel({ ...base, planMode: true, hasTime: false })).toBe("選一個日期時間");
    expect(logSubmitLabel({ ...base, isLive: true, planMode: true, hasTime: false })).toBe("選一個日期時間");
  });
});

describe("logSheetCopy（說明與 toast）", () => {
  it("排行程：說明與 toast 一致都是當天早上（UX-11）", () => {
    expect(logSheetCopy("next_noon", true)).toEqual({ hint: "當天早上會提醒你。", toast: "排好了，當天早上會提醒你。" });
  });

  it("排行程模式還沒選時間，也先講當天早上", () => {
    expect(logSheetCopy("next_noon", false, true).hint).toBe("當天早上會提醒你。");
  });

  it("一般記一筆依提醒設定", () => {
    expect(logSheetCopy("next_noon", false).hint).toContain("明天中午");
  });

  it("訪客不講「明天中午會問你」，講先登入、填的會留著（UX-28）", () => {
    const hint = logSheetCopy("next_noon", false, false, true).hint;
    expect(hint).not.toContain("明天中午");
    expect(hint).toContain("登入");
    expect(logSheetCopy("next_noon", true, true, true).hint).toBe(hint);
  });
});
