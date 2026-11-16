/**
 * 問卷第三題挑的作品（UX-15，純函式）：只當品味資料，不寫日誌。
 * 看過的沒有日期可填（journal_entries.experienced_at 必填）、想看的不排日期，
 * 寫進日誌會出現假日期、月曆、「現在想說說嗎？」提醒；所以存在既有 settings 表（每人一列，
 * key = taste_picks:<userId>，同提醒設定 journal_reminder:<userId> 的寫法），不加 migration。
 */

import { UUID_PATTERN } from "@/lib/journal/types";
import type { TastePick } from "./questionnaire";

export const TASTE_PICKS_KEY = "taste_picks";
/** 問卷每次最多 3 部；留一點餘裕給之後重答 */
export const MAX_STORED_PICKS = 30;

export interface StoredTastePick extends TastePick {
  /** 挑的時間（ISO） */
  at: string;
}

export function tastePicksKey(userId: string): string {
  return `${TASTE_PICKS_KEY}:${userId}`;
}

function isStoredPick(value: unknown): value is StoredTastePick {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.workId === "string" &&
    UUID_PATTERN.test(raw.workId) &&
    typeof raw.seen === "boolean" &&
    typeof raw.at === "string" &&
    !Number.isNaN(Date.parse(raw.at))
  );
}

export function parseStoredPicks(value: unknown): StoredTastePick[] {
  const picks = (value as { picks?: unknown } | null)?.picks;
  if (!Array.isArray(picks)) return [];
  return picks.filter(isStoredPick).map(({ workId, seen, at }) => ({ workId, seen, at }));
}

export function mergeTastePicks(
  existing: readonly StoredTastePick[],
  incoming: readonly TastePick[],
  now: Date,
): StoredTastePick[] {
  const at = now.toISOString();
  const fresh = incoming.map(({ workId, seen }) => ({ workId, seen, at }));
  const freshIds = new Set(fresh.map((pick) => pick.workId));
  return [...fresh, ...existing.filter((pick) => !freshIds.has(pick.workId))].slice(0, MAX_STORED_PICKS);
}
