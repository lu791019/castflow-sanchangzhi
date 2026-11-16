import type { PopoverDOM } from "driver.js";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STEPS } from "@/lib/tour/steps";
import type { StepDef } from "@/lib/tour/types";
import { decorateCard, primaryAction } from "./tour-card";

describe("primaryAction", () => {
  it("動作步驟的主鈕：幫你點是「下一步」，跳過填資料的寫明不送出（先不排／先不記，下一步）", () => {
    for (const step of Object.values(STEPS) as StepDef[]) {
      if (step.mode !== "action") continue;
      const label = step.assist === "click" ? "下一步" : step.assist.label;
      expect(primaryAction(step), step.id).toEqual({ label, action: "assist" });
    }
    expect(primaryAction(STEPS["plan-submit"])?.label).toBe("先不排，下一步");
    expect(primaryAction(STEPS["log-work"])?.label).toBe("先不記，下一步");
    expect(primaryAction(STEPS["log-actions"])?.label).toBe("先不記，下一步");
  });

  it("說明步驟：有下一張是「下一步」、最後一張是「完成」；分岔卡沒有主鈕", () => {
    expect(primaryAction(STEPS.goal)).toEqual({ label: "下一步", action: "next" });
    expect(primaryAction(STEPS["plan-center"])).toEqual({ label: "完成", action: "done" });
    expect(primaryAction(STEPS.fork)).toBeNull();
  });
});

describe("decorateCard（DOM）", () => {
  let restore: () => void;

  beforeEach(() => {
    const { document, HTMLElement } = parseHTML("<!doctype html><html><body></body></html>");
    const saved = { document: globalThis.document, HTMLElement: globalThis.HTMLElement };
    Object.assign(globalThis, { document, HTMLElement });
    restore = () => Object.assign(globalThis, saved);
  });

  afterEach(() => restore());

  function render(step: StepDef) {
    const wrapper = document.createElement("div");
    const title = document.createElement("header");
    const description = document.createElement("p");
    const footer = document.createElement("footer");
    wrapper.append(title, description, footer);
    document.body.append(wrapper);
    const handlers = { onNext: vi.fn(), onSkip: vi.fn(), onChoose: vi.fn() };
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function noop() {});
    decorateCard({ wrapper, title, description, footer } as unknown as PopoverDOM, step, handlers);
    return { wrapper, handlers, focus };
  }

  it("動作卡：主鈕「下一步」拿預設焦點，略過仍在", async () => {
    const { wrapper, handlers, focus } = render(STEPS["log-center"]);
    const primary = wrapper.querySelector<HTMLButtonElement>(".tour-primary");
    expect(primary?.textContent).toBe("下一步");
    expect(primary?.dataset.tourAction).toBe("assist");
    expect(wrapper.querySelector(".tour-skip")?.textContent).toBe("略過");

    await Promise.resolve();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.contexts[0]).toBe(primary);

    primary?.click();
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    expect(handlers.onSkip).not.toHaveBeenCalled();
  });

  it("sheet 裡的動作卡（要填資料）也有主鈕與略過", () => {
    const { wrapper } = render(STEPS["plan-submit"]);
    expect(wrapper.querySelector(".tour-primary")?.textContent).toBe("先不排，下一步");
    expect(wrapper.querySelector(".tour-skip")).not.toBeNull();
  });
});
