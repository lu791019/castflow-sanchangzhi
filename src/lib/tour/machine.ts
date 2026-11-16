/** 導覽狀態機（純函式）：在哪一頁、要不要播、播到第幾步、動作步驟完成後去哪 */

import { AUTO_START_PAGE, FIRST_STEP, flowOf, ROUTES, STEPS } from "./steps";
import type { StepId, TourFlow, TourPage, TourState } from "./types";

export function pageOf(pathname: string): TourPage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return "feed";
  if (path === "/before") return "before";
  if (path === "/journal") return "journal";
  if (path === "/say") return "say";
  if (path === "/notifications/enable") return "notify";
  if (/^\/s\/[^/]+$/.test(path)) return "article";
  return null;
}

/** 「步驟 n／N」：在所屬路線的位置（目標句、分岔卡兩條路線都是第 1、2 步） */
export function progressOf(step: StepId): { index: number; total: number } {
  const routes: readonly (readonly StepId[])[] = [ROUTES.guest, ROUTES.plan, ROUTES.log, ROUTES.logSay];
  // log-say 只在 logSay 路線；其餘取第一條含它的路線
  const route = step === "log-say" ? ROUTES.logSay : routes.find((candidate) => candidate.includes(step)) ?? ROUTES.plan;
  return { index: route.indexOf(step) + 1, total: route.length };
}

export interface DecideInput {
  flow: TourFlow;
  stored: TourState | null;
  pathname: string;
  /** navigator.webdriver（Playwright）：不自動播，避免擋其他 E2E */
  webdriver: boolean;
  forced: boolean;
}

export type Decision = { kind: "idle" } | { kind: "start"; step: StepId } | { kind: "show"; step: StepId };

const IDLE: Decision = { kind: "idle" };

export function decide({ flow, stored, pathname, webdriver, forced }: DecideInput): Decision {
  const page = pageOf(pathname);
  if (!page) return IDLE;
  const automatic = !webdriver || forced;

  if (stored?.status === "done") return IDLE;
  if (stored?.status === "active") {
    if (flowOf(stored.step) !== flow) return IDLE;
    if (STEPS[stored.step].page !== page) return IDLE;
    return stored.explicit || automatic ? { kind: "show", step: stored.step } : IDLE;
  }
  if (page === AUTO_START_PAGE[flow] && automatic) return { kind: "start", step: FIRST_STEP[flow] };
  return IDLE;
}

/** 回到 sheet 裡的步驟但 sheet 沒開（重新整理、回上一頁）→ 退回打開 sheet 的那一步 */
export function resumeStep(step: StepId, sheetOpen: boolean): StepId {
  const def = STEPS[step];
  return def.inSheet && !sheetOpen && def.resumeAs ? def.resumeAs : step;
}

export type TourEvent = { type: "click" } | { type: "appear"; selector: string } | { type: "page"; page: TourPage };

/** 動作步驟收到事件 → 下一步；不相干回 null */
export function outcomeTarget(step: StepId, event: TourEvent): StepId | null {
  const def = STEPS[step];
  if (def.mode !== "action") return null;
  const hit = def.outcomes.find((outcome) => {
    if (outcome.on !== event.type) return false;
    if (outcome.on === "appear" && event.type === "appear") return outcome.selector === event.selector;
    if (outcome.on === "page" && event.type === "page") return outcome.page === event.page;
    return true;
  });
  return hit?.to ?? null;
}
