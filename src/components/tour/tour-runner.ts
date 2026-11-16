/**
 * 導覽執行器（瀏覽器端，非 React）：讀寫進度、找目標、顯示卡片、偵測「真的點」與完成條件。
 * 換頁的步驟先把下一步寫進 localStorage，由新頁面的 TourHost 接手（跨頁續播）。
 * 動作步驟的「下一步」照 steps 的 assist：幫你點被照亮的元素，或收起 sheet 跳到 skipTo（不同頁就換過去）。
 */

import { decide, outcomeTarget, pageOf, resumeStep } from "@/lib/tour/machine";
import { FIRST_STEP, SHEET_SELECTOR, STEPS } from "@/lib/tour/steps";
import { isForced, readState, writeState, type TourStorage } from "@/lib/tour/storage";
import type { ActionStep, StepId, TourFlow, TourPage } from "@/lib/tour/types";
import { createTourDriver } from "./tour-driver";
import { assistTarget, closeSheet, exists, findTarget, waitFor } from "./tour-dom";

/** 等目標元素：頁面資料是 server 渲染，sheet 動畫約 300ms；排進行程要先建作品，給寬一點 */
const TARGET_TIMEOUT_MS = 6000;
const OUTCOME_POLL_MS = 150;
/** sheet 被關掉（Esc、拖下來）多久沒等到完成條件 → 退回打開 sheet 那一步 */
const SHEET_GONE_GRACE_MS = 900;
/** 按過送出／現在就想說：之後 sheet 消失是在換頁（第一次記下會去通知權限引導），這段時間不退回 */
const COMMIT_HOLD_MS = 20_000;
const COMMIT_SELECTOR = '[data-tour="log-submit"], [data-tour="log-say-now"]';

export const PAGE_PATHS: Readonly<Record<TourPage, string>> = {
  before: "/before",
  journal: "/journal",
  feed: "/",
  article: "/",
  say: "/say",
  notify: "/notifications/enable",
};

export interface TourRunner {
  /** 網址變了（含第一次掛上）：續播、自動開始或收起 */
  sync: (pathname: string) => void;
  /** 重看導覽：從第一步開始；不在起點頁就回傳要去的網址 */
  replay: (pathname: string) => string | null;
  destroy: () => void;
}

export interface TourRunnerOptions {
  flow: TourFlow;
  key: string;
  storage: TourStorage;
  /** 「下一步」跳到別頁的卡時換頁（TourHost 給 router.push） */
  navigate: (path: string) => void;
}

export function createTourRunner({ flow, key, storage, navigate }: TourRunnerOptions): TourRunner {
  const card = createTourDriver();
  let current: StepId | null = null;
  let token = 0;
  let explicit = false;
  let teardown: Array<() => void> = [];

  const clearWatchers = () => {
    teardown.forEach((stop) => stop());
    teardown = [];
  };

  const stop = () => {
    token += 1;
    clearWatchers();
    current = null;
    card.destroy();
  };

  const finish = () => {
    writeState(storage, key, { status: "done" });
    stop();
  };

  const here = (): TourPage | null => pageOf(window.location.pathname);

  const advance = (next: StepId) => {
    writeState(storage, key, { status: "active", step: next, explicit });
    clearWatchers();
    if (STEPS[next].page === here()) {
      card.wait();
      void render(next);
    } else {
      // 會換頁：下一頁的 TourHost 接手
      stop();
    }
  };

  /** 動作步驟按「下一步」：幫你點（點擊照常觸發 outcomes），或不替人填資料、直接跳過 */
  const assist = (step: ActionStep, element: Element | null) => {
    if (step.assist === "click") {
      const button = element ? assistTarget(element, step.clickWithin) : null;
      if (button) button.click();
      else finish();
      return;
    }
    const to = step.assist.skipTo;
    closeSheet(SHEET_SELECTOR);
    advance(to);
    if (STEPS[to].page !== here()) navigate(PAGE_PATHS[STEPS[to].page]);
  };

  const watchAction = (step: ActionStep, element: Element | null) => {
    const myToken = token;
    const live = () => myToken === token;
    for (const outcome of step.outcomes) {
      if (outcome.on === "click" && element) {
        const onClick = (event: Event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target || !element.contains(target)) return;
          if (step.clickWithin && !target.closest(step.clickWithin)) return;
          advance(outcome.to);
        };
        document.addEventListener("click", onClick, true);
        teardown.push(() => document.removeEventListener("click", onClick, true));
      }
      if (outcome.on === "appear") {
        const timer = setInterval(() => {
          if (live() && exists(outcome.selector)) advance(outcome.to);
        }, OUTCOME_POLL_MS);
        teardown.push(() => clearInterval(timer));
      }
    }
    if (step.inSheet && step.resumeAs) watchSheetClosed(step.resumeAs, live);
  };

  /** sheet 沒送出就被關掉 → 退回打開 sheet 那一步 */
  const watchSheetClosed = (back: StepId, live: () => boolean) => {
    let goneSince: number | null = null;
    let committedAt = 0;
    const onCommit = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(COMMIT_SELECTOR)) committedAt = Date.now();
    };
    document.addEventListener("click", onCommit, true);
    const timer = setInterval(() => {
      if (!live()) return;
      if (exists(SHEET_SELECTOR) || Date.now() - committedAt < COMMIT_HOLD_MS) {
        goneSince = null;
        return;
      }
      goneSince ??= Date.now();
      if (Date.now() - goneSince >= SHEET_GONE_GRACE_MS) advance(back);
    }, OUTCOME_POLL_MS);
    teardown.push(() => {
      clearInterval(timer);
      document.removeEventListener("click", onCommit, true);
    });
  };

  const handlers = (step: StepId, element: Element | null) => ({
    onSkip: finish,
    onChoose: (to: StepId) => advance(to),
    onNext: () => {
      const def = STEPS[step];
      if (def.mode === "action") assist(def, element);
      else if (def.mode === "info" && def.next) advance(def.next);
      else finish();
    },
  });

  async function render(step: StepId): Promise<void> {
    token += 1;
    const myToken = token;
    clearWatchers();
    current = step;
    const def = STEPS[step];
    const cancelled = () => myToken !== token;
    if (def.waitGone) {
      const gone = def.waitGone;
      await waitFor(() => !exists(gone) || null, TARGET_TIMEOUT_MS, cancelled);
    }
    const element = def.target
      ? await waitFor(() => findTarget(def.target ?? []), TARGET_TIMEOUT_MS, cancelled)
      : null;
    if (myToken !== token) return;
    if (def.target && !element && def.mode === "action") {
      // 找不到要點的東西（例如這週沒有可排的卡）：不卡住，直接收尾
      console.warn("[tour] 找不到導覽目標，提前結束", step);
      finish();
      return;
    }
    card.show(def, element, handlers(step, element));
    if (def.mode === "action") watchAction(def, element);
  }

  return {
    sync(pathname) {
      const page = pageOf(pathname);
      // 動作步驟的「換頁」完成條件（按了現在就想說 → 說一段）
      if (current && page) {
        const next = outcomeTarget(current, { type: "page", page });
        if (next) {
          advance(next);
          return;
        }
      }
      const stored = readState(storage, key);
      explicit = stored?.status === "active" ? stored.explicit : false;
      const decision = decide({ flow, stored, pathname, webdriver: navigator.webdriver, forced: isForced(storage) });
      if (decision.kind === "idle") {
        if (current && STEPS[current].page !== page) stop();
        return;
      }
      if (decision.kind === "start") writeState(storage, key, { status: "active", step: decision.step, explicit: false });
      const step = resumeStep(decision.step, exists(SHEET_SELECTOR));
      if (step === current) return;
      void render(step);
    },
    replay(pathname) {
      const first = FIRST_STEP[flow];
      explicit = true;
      writeState(storage, key, { status: "active", step: first, explicit: true });
      if (pageOf(pathname) === STEPS[first].page) {
        void render(first);
        return null;
      }
      stop();
      return PAGE_PATHS[STEPS[first].page];
    },
    destroy: stop,
  };
}
