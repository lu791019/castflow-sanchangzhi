/** 〇九 下拉更新：跟手阻尼 0.5×、位移上限 120、門檻＝拖曳 144px（位移 72） */
export const PULL_DAMPING = 0.5;
export const PULL_MAX = 120;
export const PULL_THRESHOLD = 72;
/** 回應慢（>300ms）時停在 44px，字改「翻頁中」 */
export const PULL_HOLD = 44;
export const PULL_SLOW_MS = 300;

export function pullOffset(drag: number): number {
  return Math.min(PULL_MAX, Math.max(0, drag * PULL_DAMPING));
}

export function pullPastThreshold(drag: number): boolean {
  return pullOffset(drag) >= PULL_THRESHOLD;
}
