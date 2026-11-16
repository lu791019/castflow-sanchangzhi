import { describe, expect, it } from "vitest";
import { STEPS, TOAST_SELECTOR } from "./steps";
import type { ActionStep, StepDef, StepId } from "./types";

const ALL = Object.values(STEPS) as StepDef[];
const ACTIONS = ALL.filter((step): step is ActionStep => step.mode === "action");

/** 從 from 照說明卡的 next 一路走到底（skipTo 落點之後會看到的卡） */
function chainFrom(from: StepId): StepId[] {
  const seen: StepId[] = [];
  let at: StepId | null = from;
  while (at && !seen.includes(at)) {
    seen.push(at);
    const def: StepDef = STEPS[at];
    at = def.mode === "info" ? def.next : null;
  }
  return seen;
}

describe("動作步驟的「下一步」（assist）", () => {
  it("每個動作步驟都有 assist 設定", () => {
    expect(ACTIONS.length).toBeGreaterThan(0);
    for (const step of ACTIONS) {
      expect(step.assist, step.id).toBeDefined();
      expect(step.assist === "click" || typeof step.assist.skipTo === "string", step.id).toBe(true);
    }
  });

  it("要填資料的步驟（sheet 裡）不幫你點，只能跳過", () => {
    for (const step of ACTIONS.filter((candidate) => candidate.inSheet)) {
      expect(step.assist, step.id).not.toBe("click");
    }
  });

  it("幫你點的步驟都靠點擊前進", () => {
    for (const step of ACTIONS.filter((candidate) => candidate.assist === "click")) {
      expect(step.outcomes.some((outcome) => outcome.on === "click"), step.id).toBe(true);
      expect(step.target, step.id).not.toBeNull();
    }
  });

  it("skipTo 的落點與之後的卡都不宣稱已寫入", () => {
    for (const step of ACTIONS) {
      if (step.assist === "click") continue;
      const target = STEPS[step.assist.skipTo];
      expect(target.mode, `${step.id} → ${target.id}`).toBe("info");
      for (const id of chainFrom(target.id)) {
        expect(STEPS[id].claimsSaved, `${step.id} → ${id}`).toBeUndefined();
      }
    }
  });

  it("寫入後才會到的卡（送出後的提示、通知權限引導回來）都標了 claimsSaved", () => {
    const afterWrite = ACTIONS.flatMap((step) =>
      step.outcomes.filter(
        (outcome) => (outcome.on === "appear" && outcome.selector === TOAST_SELECTOR) || (outcome.on === "page" && outcome.page === "notify"),
      ),
    ).map((outcome) => outcome.to);
    expect(afterWrite.length).toBeGreaterThan(0);
    for (const id of afterWrite) expect(STEPS[id].claimsSaved, id).toBe(true);
  });

  it("排行程與記一筆兩條路線跳過填資料後落在圓鈕說明卡", () => {
    expect(STEPS["plan-submit"]).toMatchObject({ assist: { skipTo: "plan-center" } });
    expect(STEPS["log-work"]).toMatchObject({ assist: { skipTo: "plan-center" } });
    expect(STEPS["log-actions"]).toMatchObject({ assist: { skipTo: "plan-center" } });
  });
});
