/**
 * 「同名＋同日期歸入同一本場刊」比對規則（純函式）：
 * 1. 同類型（演出 live／展覽 exhibition 不互通）
 * 2. 名稱正規化後完全相同（name.ts：NFKC、小寫、去標點符號空白）
 * 3. 日期相近：演出區間重疊或相鄰一天（多日音樂祭各晚的人只寫自己那天）；
 *    展覽來訪日相差 90 天內（多數人不寫展期，只有來訪那天）。沒寫日期時以記一筆那天當單日
 * 多本都符合 → 期號最早（第一位記下的人建的）。沒有日期的舊作品不參與比對。
 * 命中後不改既有場刊的資料（場外資訊以第一位記下的人為準）。
 */

import type { LiveDateRange } from "./dates";

export type LiveKind = "live" | "exhibition";

export interface ProgrammeCandidate {
  id: string;
  kind: string;
  live_key: string | null;
  event_date: string | null;
  event_end_date: string | null;
  issue_no: number;
}

export interface DayRange {
  start: string;
  end: string;
}

export interface ProgrammeQuery {
  kind: LiveKind;
  key: string;
  range: DayRange;
}

export function programmeRange(work: Pick<ProgrammeCandidate, "event_date" | "event_end_date">): DayRange | null {
  if (!work.event_date) return null;
  return { start: work.event_date, end: work.event_end_date ?? work.event_date };
}

export function toDayRange(range: LiveDateRange): DayRange {
  return { start: range.start, end: range.end ?? range.start };
}

/** 同一本場刊容許的日期間隔（天）：演出相鄰一天、展覽 90 天（Dex 10/11 拍板） */
export const MAX_DAY_GAP: Record<LiveKind, number> = { live: 1, exhibition: 90 };

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/** 兩段日期之間隔幾天；重疊（含端點同一天）為 0 */
export function dayGap(a: DayRange, b: DayRange): number {
  const [earlier, later] = a.start <= b.start ? [a, b] : [b, a];
  return Math.max(0, dayNumber(later.start) - dayNumber(earlier.end));
}

export function pickProgramme(
  candidates: readonly ProgrammeCandidate[],
  query: ProgrammeQuery,
): ProgrammeCandidate | null {
  const hits = candidates.filter((work) => {
    if (work.kind !== query.kind || work.live_key !== query.key) return false;
    const range = programmeRange(work);
    return range !== null && dayGap(range, query.range) <= MAX_DAY_GAP[query.kind];
  });
  if (hits.length === 0) return null;
  return hits.reduce((first, next) => (next.issue_no < first.issue_no ? next : first));
}
