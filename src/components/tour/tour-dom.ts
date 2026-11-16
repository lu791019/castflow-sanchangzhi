/** 找導覽目標：只認 data-tour，同名多個時取第一個看得見的（手機底部導覽／平板浮動圓鈕各一份） */

import { tourSelector } from "@/lib/tour/steps";

const POLL_MS = 120;

export function isVisible(node: Element): boolean {
  return node.getClientRects().length > 0;
}

export function findTarget(names: readonly string[]): Element | null {
  for (const name of names) {
    const hit = Array.from(document.querySelectorAll(tourSelector(name))).find(isVisible);
    if (hit) return hit;
  }
  return null;
}

/** 輪詢等元素出現；cancelled() 為真就提早結束（換步驟、離開頁面） */
export function waitFor<T>(probe: () => T | null, timeoutMs: number, cancelled: () => boolean): Promise<T | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (cancelled()) return resolve(null);
      const value = probe();
      if (value) return resolve(value);
      if (Date.now() - started >= timeoutMs) return resolve(null);
      setTimeout(tick, POLL_MS);
    };
    tick();
  });
}

export function exists(selector: string): boolean {
  return Array.from(document.querySelectorAll(selector)).some(isVisible);
}

const CLICKABLE = "a, button";

/** 「下一步」幫你點的那個元素：有 clickWithin 就找它，沒有就是元素本身或其中第一個連結／按鈕 */
export function assistTarget(element: Element, within?: string): HTMLElement | null {
  const selector = within ?? CLICKABLE;
  const hit = element.matches(selector) ? element : element.querySelector(selector);
  return hit instanceof HTMLElement ? hit : null;
}

/** 收起記一筆 sheet（sheet 自己聽 Esc；作品選擇器開著時不認 Esc，靠換頁收起） */
export function closeSheet(sheetSelector: string): void {
  if (exists(sheetSelector)) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}
