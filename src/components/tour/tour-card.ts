/**
 * 導覽卡內容（DOM，交給 driver.js 的 onPopoverRender 塞進卡片）。
 * 結構照 Dex 10/14 影片：眉標「— 步驟 n／N」、粗體短標題、一行說明；
 * 底列左邊進度點（目前那步是拉長的膠囊）、中間「略過」、右邊墨色膠囊主鈕＋ember 圓點箭頭。
 * 說明步驟主鈕「下一步／完成」；動作步驟主鈕「下一步」（幫你點或跳過，見 steps 的 assist）；分岔卡是兩個選項鈕。
 * 主鈕一律拿預設焦點，「略過」是次要鈕。
 */

import type { PopoverDOM } from "driver.js";
import { progressOf } from "@/lib/tour/machine";
import type { StepDef, StepId } from "@/lib/tour/types";

export interface CardHandlers {
  onNext: () => void;
  onSkip: () => void;
  onChoose: (to: StepId) => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function arrowIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M5 12h14M13 6l6 6-6 6");
  svg.append(path);
  return svg;
}

function dots(index: number, total: number): HTMLElement {
  const wrap = el("span", "tour-dots");
  wrap.setAttribute("aria-hidden", "true");
  for (let i = 1; i <= total; i += 1) wrap.append(el("span", i === index ? "tour-dot tour-dot-on" : "tour-dot"));
  return wrap;
}

/** 主鈕：文字與 data-tour-action（next／done／assist）；分岔卡沒有主鈕 */
export function primaryAction(step: StepDef): { label: string; action: "next" | "done" | "assist" } | null {
  if (step.mode === "fork") return null;
  if (step.mode === "action") return { label: step.assist === "click" ? "下一步" : step.assist.label, action: "assist" };
  return step.next ? { label: "下一步", action: "next" } : { label: "完成", action: "done" };
}

function primaryButton(step: StepDef, onNext: () => void): HTMLButtonElement | null {
  const spec = primaryAction(step);
  if (!spec) return null;
  const button = el("button", "tour-primary");
  button.type = "button";
  button.dataset.tourAction = spec.action;
  button.append(el("span", "", spec.label));
  const knob = el("span", "tour-knob");
  knob.append(arrowIcon());
  button.append(knob);
  button.addEventListener("click", onNext);
  return button;
}

function choices(step: StepDef, onChoose: (to: StepId) => void): HTMLElement | null {
  if (step.mode !== "fork") return null;
  const list = el("div", "tour-choices");
  for (const choice of step.choices) {
    const button = el("button", "tour-choice");
    button.type = "button";
    button.dataset.tourChoice = choice.to;
    button.append(el("span", "", choice.label));
    button.append(arrowIcon());
    button.addEventListener("click", () => onChoose(choice.to));
    list.append(button);
  }
  return list;
}

/** 把 driver.js 的預設卡改成散場誌版本（標題、說明 driver 已填好） */
export function decorateCard(popover: PopoverDOM, step: StepDef, handlers: CardHandlers): void {
  const { index, total } = progressOf(step.id);
  const eyebrow = el("span", "tour-eyebrow", `步驟 ${index}／${total}`);
  popover.wrapper.insertBefore(eyebrow, popover.title);
  popover.wrapper.dataset.tourStep = step.id;

  const options = choices(step, handlers.onChoose);
  if (options) popover.description.after(options);

  const footer = el("div", "tour-footer");
  footer.append(dots(index, total));
  const skip = el("button", "tour-skip", "略過");
  skip.type = "button";
  skip.addEventListener("click", handlers.onSkip);
  footer.append(skip);
  const primary = primaryButton(step, handlers.onNext);
  if (primary) footer.append(primary);
  popover.footer.replaceWith(footer);

  // driver.js 在 onPopoverRender 之後會把焦點給卡片裡第一個可聚焦元素（＝略過）；改給主鈕或第一個選項
  const preferred = primary ?? options?.querySelector("button") ?? null;
  if (preferred) queueMicrotask(() => preferred.focus());
}
