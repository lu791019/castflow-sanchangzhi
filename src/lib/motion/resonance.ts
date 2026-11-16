/**
 * 「這句我也是」的時間與手勢（P3 Token TIME・MOTION）：
 * press.longPress 450ms 浮出；motion.popover 150ms；motion.resonanceLine 畫線 280ms、收回淡出 200ms；
 * motion.count 直接換字＋顏色 150ms。減少動態時全部改為直接出現／消失（見 resonance.css）。
 */
export const RESONANCE_LONG_PRESS_MS = 450;
export const RESONANCE_POPOVER_MS = 150;
export const RESONANCE_LINE_DRAW_MS = 280;
export const RESONANCE_LINE_FADE_MS = 200;
/** 長按期間手指移動超過這個距離視為捲動，取消長按 */
export const RESONANCE_MOVE_TOLERANCE_PX = 10;

export function movedTooFar(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > RESONANCE_MOVE_TOLERANCE_PX;
}
