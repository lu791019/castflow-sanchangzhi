/**
 * 中央圓鈕按滿 → 說一段直接開始錄音（P1 判定規則：「省掉再按一次」）。
 * 圓鈕滿圈時登記一筆交接，說一段頁掛載時取走：
 * - 手指還按著 → 放開就完成（同一個手勢從圓鈕延續到錄音）
 * - 已經放開 → 錄音照樣開始，改成點一下圓鈕完成
 * 交接只存在記憶體（同一次 client 導航內有效），逾時就作廢，避免之後誤開麥克風。
 */

export const HOLD_HANDOFF_TTL_MS = 5_000;

export interface HoldHandoff {
  /** 手指是否已經放開 */
  released(): boolean;
  /** 放開時呼叫一次；已放開則不會再呼叫。回傳取消訂閱 */
  onRelease(callback: () => void): () => void;
}

interface HandoffState {
  createdAt: number;
  released: boolean;
  listeners: Set<() => void>;
}

type ReleaseTarget = Pick<Window, "addEventListener" | "removeEventListener">;

let pending: HandoffState | null = null;

/** 圓鈕滿圈時呼叫（此刻手指一定按著） */
export function beginHoldHandoff(target: ReleaseTarget = window, now: number = Date.now()): void {
  const state: HandoffState = { createdAt: now, released: false, listeners: new Set() };
  const release = () => {
    target.removeEventListener("pointerup", release, true);
    target.removeEventListener("pointercancel", release, true);
    state.released = true;
    state.listeners.forEach((listener) => listener());
    state.listeners.clear();
  };
  target.addEventListener("pointerup", release, true);
  target.addEventListener("pointercancel", release, true);
  pending = state;
}

/** 滿圈後手指滑出取消：撤銷交接（監聽留著也只會在下次放開時拆掉自己） */
export function cancelHoldHandoff(): void {
  pending = null;
}

/** 說一段頁取走交接；沒有或已逾時回 null。只能取一次 */
export function takeHoldHandoff(now: number = Date.now()): HoldHandoff | null {
  const state = pending;
  pending = null;
  if (!state || now - state.createdAt > HOLD_HANDOFF_TTL_MS) return null;
  return {
    released: () => state.released,
    onRelease: (callback) => {
      if (state.released) return () => {};
      state.listeners.add(callback);
      return () => state.listeners.delete(callback);
    },
  };
}
