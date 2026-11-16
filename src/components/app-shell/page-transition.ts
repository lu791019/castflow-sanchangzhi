/**
 * 頁面轉場（P4 〇四＋Q-44）：社交殼 template 每次換頁重新掛載時套用的 class。
 * - 底部導覽四格（散場之前／目錄／日誌／我的）與寬螢幕的索引：160ms 淡入＋往上 4px（不做左右滑，iPhone PWA 返回手勢衝突）
 * - 說一段是全螢幕 fixed 頁，只淡入（位移會讓 fixed 子元素跟著動）
 * - 其他頁：新內容 opacity 0→1、往上 8px，60–220ms
 */

import { BEFORE_PATH } from "./nav-routes";

const TAB_ROOTS = new Set([BEFORE_PATH, "/", "/journal", "/me", "/catalog"]);
const FADE_ONLY_PREFIXES = ["/say"];

export type PageTransitionClass = "p4-tab-shift" | "p4-tab-page" | "p4-page";

export function transitionClass(pathname: string): PageTransitionClass {
  if (TAB_ROOTS.has(pathname)) return "p4-tab-shift";
  if (FADE_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "p4-tab-page";
  return "p4-page";
}
