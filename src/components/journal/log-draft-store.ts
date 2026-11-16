/**
 * 記一筆草稿的瀏覽器端儲存（localStorage，只存一份）。
 * 私密瀏覽或被封鎖時存取會丟錯：存不了回 false 讓呼叫端告訴使用者；讀不到當作沒有，並在 console 留紀錄。
 */

import type { LogSheetPrefill } from "./log-sheet";
import { LOG_DRAFT_KEY, LOG_DRAFT_VERSION, parseLogDraft, type LogDraft } from "@/lib/journal/log-draft";

export function saveLogDraft(draft: Omit<LogDraft, "version" | "savedAt">, now: Date = new Date()): boolean {
  try {
    const stored: LogDraft = { ...draft, version: LOG_DRAFT_VERSION, savedAt: now.toISOString() };
    window.localStorage.setItem(LOG_DRAFT_KEY, JSON.stringify(stored));
    return true;
  } catch (error) {
    console.error("[log-sheet] 暫存草稿失敗", error instanceof Error ? error.message : error);
    return false;
  }
}

export function loadLogDraft(now: Date = new Date()): LogDraft | null {
  try {
    const draft = parseLogDraft(window.localStorage.getItem(LOG_DRAFT_KEY), now);
    if (!draft) window.localStorage.removeItem(LOG_DRAFT_KEY);
    return draft;
  } catch (error) {
    console.error("[log-sheet] 讀取草稿失敗", error instanceof Error ? error.message : error);
    return null;
  }
}

export function clearLogDraft(): void {
  try {
    window.localStorage.removeItem(LOG_DRAFT_KEY);
  } catch (error) {
    console.error("[log-sheet] 清除草稿失敗", error instanceof Error ? error.message : error);
  }
}

/** 登入回來：把草稿換成 sheet 的預填（沒有可還原的回 null） */
export function restoredPrefill(now: Date = new Date()): LogSheetPrefill | null {
  const draft = loadLogDraft(now);
  if (!draft) return null;
  return {
    work: draft.work ?? undefined,
    place: draft.place ?? undefined,
    live: draft.live,
    when: draft.when,
    custom: draft.custom,
    companions: draft.companions,
    restored: true,
  };
}
