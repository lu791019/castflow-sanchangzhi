/**
 * 通知權限引導要不要出現（瀏覽器端）：不要一打開 App 就要權限，記下一筆之後才問，且只問一次。
 * 已授權／已拒絕／不支援都不問；iPhone 非主畫面模式要先引導加入主畫面。
 */

import { detectPushSupport } from "@/lib/push/client";

const PROMPTED_KEY = "castflow.push-prompted";

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(PROMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPushPrompted(): void {
  try {
    window.localStorage.setItem(PROMPTED_KEY, "1");
  } catch {
    // 無痕模式等存不了：最多下次再問一次，不影響功能
  }
}

export function shouldAskPushPermission(): boolean {
  if (typeof window === "undefined" || readFlag()) return false;
  const support = detectPushSupport();
  if (support === "needs-home-screen") return true;
  return support === "supported" && Notification.permission === "default";
}
