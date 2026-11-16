/**
 * 收集狀態（本機 JSON 檔，預設 worker/events-state.json，不入庫）：
 * 上次成功跑的日期（每 N 天一次）、上次嘗試的日期（整輪失敗隔天再試）＋每個活動頁抓過的時間（24 小時內不重抓；活動頁 7 天才重抓）、起訖日、KKTIX 圖片、Accupass 詳情。
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import type { AccupassDetail } from "./accupass.ts";

export interface PageMemo {
  fetchedAt: number;
  /** 館方明細頁補的開始日（臺博館） */
  startsOn?: string | null;
  endsOn?: string | null;
  image?: string | null;
  detail?: AccupassDetail | null;
}

export interface EventsState {
  lastRunDay: string | null;
  lastAttemptDay?: string | null;
  pages: Record<string, PageMemo>;
}

const DAY_MS = 86_400_000;
/** 頁面紀錄留多久（之後若還在列表裡會再抓一次） */
export const MEMO_KEEP_MS = 60 * DAY_MS;

export function emptyState(): EventsState {
  return { lastRunDay: null, pages: {} };
}

/** 讀檔內容 → 狀態；壞掉就當空的（最多多抓一輪） */
export function parseState(text: string): EventsState {
  try {
    const data = JSON.parse(text) as Partial<EventsState>;
    const pages = data.pages && typeof data.pages === "object" ? data.pages : {};
    const valid = Object.entries(pages).filter(([, memo]) => memo && typeof memo.fetchedAt === "number");
    return {
      lastRunDay: typeof data.lastRunDay === "string" ? data.lastRunDay : null,
      lastAttemptDay: typeof data.lastAttemptDay === "string" ? data.lastAttemptDay : null,
      pages: Object.fromEntries(valid),
    };
  } catch {
    return emptyState();
  }
}

/** 拿掉太舊的頁面紀錄 */
export function pruneState(state: EventsState, now: number): EventsState {
  const pages = Object.entries(state.pages).filter(([, memo]) => now - memo.fetchedAt < MEMO_KEEP_MS);
  return { ...state, pages: Object.fromEntries(pages) };
}

export function isFresh(memo: PageMemo | undefined, now: number, maxAgeMs: number): memo is PageMemo {
  return !!memo && now - memo.fetchedAt < maxAgeMs;
}

export async function loadState(filePath: string): Promise<EventsState> {
  try {
    return parseState(await readFile(filePath, "utf8"));
  } catch {
    return emptyState();
  }
}

/** 先寫暫存檔再改名，避免寫到一半被中斷留下壞檔 */
export async function saveState(filePath: string, state: EventsState): Promise<void> {
  const temp = `${filePath}.tmp`;
  await writeFile(temp, JSON.stringify(state), "utf8");
  await rename(temp, filePath);
}
