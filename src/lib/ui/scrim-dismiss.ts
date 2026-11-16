/**
 * 遮罩點擊關閉的守門（uxaudit 10/14 HIGH）：觸控按中央圓鈕時，pointerup 就打開 sheet，
 * 瀏覽器隨後補發的 click 會落在剛出現的遮罩上，被當成「點外面關閉」。
 * 只有「按下也發生在遮罩上」的那次 click 才算數，補發的幽靈點擊沒有按下事件，就不會誤關。
 */

export interface ScrimDismissGuard {
  /** 遮罩的 pointerdown */
  markPressStart(): void;
  /** 遮罩的 click：這次該不該關；判斷後清掉狀態 */
  shouldDismiss(): boolean;
}

export function createScrimDismissGuard(): ScrimDismissGuard {
  let pressed = false;
  return {
    markPressStart() {
      pressed = true;
    },
    shouldDismiss() {
      const result = pressed;
      pressed = false;
      return result;
    },
  };
}
