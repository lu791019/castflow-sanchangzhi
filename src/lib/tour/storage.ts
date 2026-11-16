/** 導覽進度存 localStorage：登入者 per user id、訪客每個瀏覽器一份；讀寫一律 try/catch（無痕或被擋時照常顯示頁面） */

import { isStepId } from "./steps";
import type { TourFlow, TourState } from "./types";

/** E2E 用：Playwright 下也自動播（tour.spec 在頁面載入前寫入） */
export const FORCE_KEY = "castflow.tour-force";

export interface TourStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function tourKey(flow: TourFlow, userId: string | null): string {
  return flow === "member" && userId ? `castflow.tour.member.${userId}` : "castflow.tour.guest";
}

export function serializeState(state: TourState): string {
  return JSON.stringify(state);
}

export function parseState(raw: string | null): TourState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (record.status === "done") return { status: "done" };
    if (record.status === "active" && isStepId(record.step)) {
      return { status: "active", step: record.step, explicit: record.explicit === true };
    }
    return null;
  } catch {
    return null;
  }
}

export function readState(storage: TourStorage, key: string): TourState | null {
  try {
    return parseState(storage.getItem(key));
  } catch {
    return null;
  }
}

export function writeState(storage: TourStorage, key: string, state: TourState): void {
  try {
    storage.setItem(key, serializeState(state));
  } catch {
    // 存不了：這次照播，下次可能再播一次，不影響功能
  }
}

export function isForced(storage: TourStorage): boolean {
  try {
    return storage.getItem(FORCE_KEY) === "1";
  } catch {
    return false;
  }
}
