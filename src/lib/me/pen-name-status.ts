/**
 * 取筆名表單的狀態文案（設計稿 P2 第一次打開 B/C；name.check：停止輸入 600ms 後查）。
 * 筆名長度沿用既有規則（1–20 字，DB check 一致），不採設計稿的 2–12 字。
 */

import { PEN_NAME_MAX_LENGTH, validatePenName } from "@/lib/auth/pen-name-rules";

export const NAME_CHECK_DEBOUNCE_MS = 600;

/** 檢查結果：available / taken；查詢失敗為 unknown（送出時 server 會再擋重複） */
export type NameCheck = "checking" | "available" | "taken" | "unknown";

export type StatusTone = "hint" | "ok" | "taken";

export interface PenNameStatus {
  text: string;
  tone: StatusTone;
  ready: boolean;
  buttonLabel: string;
  /** 跟現在的筆名一樣：主鈕停用（UX-20） */
  unchanged?: true;
}

const READY_LABEL = "就用這個";
const EMPTY_LABEL = "先寫一個筆名";
const CURRENT_LABEL = "這是你現在的筆名";

/** 主鈕跟狀態走（UX-20）：不合規則時說要改什麼，不再一律「先寫一個筆名」 */
function invalidLabel(raw: string): string {
  return Array.from(raw.trim()).length > PEN_NAME_MAX_LENGTH ? "改短一點" : "改一下筆名";
}

/** current：設定頁來改筆名時帶現在的筆名；第一次取筆名不帶 */
export function penNameStatus(raw: string, check: NameCheck, current = ""): PenNameStatus {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: `最多 ${PEN_NAME_MAX_LENGTH} 個字，中文、英文都可以。`, tone: "hint", ready: false, buttonLabel: EMPTY_LABEL };
  }
  const valid = validatePenName(raw);
  if (!valid.ok) return { text: valid.error, tone: "taken", ready: false, buttonLabel: invalidLabel(raw) };
  if (trimmed === current.trim()) {
    return { text: CURRENT_LABEL, tone: "hint", ready: false, buttonLabel: CURRENT_LABEL, unchanged: true };
  }
  switch (check) {
    case "checking":
      return { text: "查一下有沒有人用……", tone: "hint", ready: false, buttonLabel: "查一下有沒有人用" };
    case "taken":
      return { text: `「${trimmed}」已經有人用了。加一個字試試？`, tone: "taken", ready: false, buttonLabel: "換一個筆名" };
    case "unknown":
      return { text: "暫時查不到有沒有人用，送出時會再確認。", tone: "hint", ready: true, buttonLabel: READY_LABEL };
    case "available":
      return { text: "這個筆名還沒人用", tone: "ok", ready: true, buttonLabel: READY_LABEL };
  }
}
