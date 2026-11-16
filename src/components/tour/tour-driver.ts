/**
 * driver.js 包一層：一個實例從頭用到尾，換步驟用 highlight()（光圈與卡片平順移到下一個目標）。
 * 說明步驟不讓點被照亮的元素（避免誤觸換頁）；sheet 裡的步驟整張 sheet 可操作、卡片釘在頂端。
 */

import { driver, type Driver } from "driver.js";
import { stepText, WIDE_QUERY } from "@/lib/tour/steps";
import type { StepDef } from "@/lib/tour/types";
import { decorateCard, type CardHandlers } from "./tour-card";

/** html 上的旗標：sheet 步驟（tour.css 依此放行 sheet 的點擊）、等待下一步（先藏卡片）；卡片釘頂／底見 tour.css */
const IN_SHEET_CLASS = "tour-in-sheet";
const WAITING_CLASS = "tour-waiting";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface TourDriver {
  show: (step: StepDef, element: Element | null, handlers: CardHandlers) => void;
  /** 動作完成、等下一步的元素出現：卡片先淡掉，光圈留著 */
  wait: () => void;
  destroy: () => void;
}

export function createTourDriver(): TourDriver {
  let instance: Driver | null = null;

  const ensure = (): Driver => {
    if (instance?.isActive()) return instance;
    const reduced = prefersReducedMotion();
    instance = driver({
      animate: !reduced,
      smoothScroll: !reduced,
      allowClose: false,
      allowKeyboardControl: false,
      overlayClickBehavior: "none",
      overlayColor: "#141210",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 14,
      popoverOffset: 10,
      popoverClass: "tour-card",
      showButtons: [],
    });
    return instance;
  };

  const setFlags = (inSheet: boolean, waiting: boolean) => {
    const root = document.documentElement.classList;
    root.toggle(IN_SHEET_CLASS, inSheet);
    root.toggle(WAITING_CLASS, waiting);
  };

  return {
    show(step, element, handlers) {
      const active = ensure();
      setFlags(Boolean(step.inSheet), false);
      const text = stepText(step, window.matchMedia(WIDE_QUERY).matches);
      active.highlight({
        element: element ?? undefined,
        disableActiveInteraction: step.mode !== "action",
        popover: {
          title: text.title,
          description: text.body,
          side: step.side ?? "bottom",
          align: "center",
          showButtons: [],
          popoverClass: step.pin ? `tour-card tour-pin-${step.pin}` : "tour-card",
          onPopoverRender: (popover) => decorateCard(popover, step, handlers),
        },
      });
    },
    wait() {
      document.documentElement.classList.add(WAITING_CLASS);
    },
    destroy() {
      setFlags(false, false);
      instance?.destroy();
      instance = null;
    },
  };
}
