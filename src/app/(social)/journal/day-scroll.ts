/** 日誌選日後捲到當天明細（UX-05 點日期格、UX-06 點「接下來」那筆）；導覽 4d 要指的那筆 */

import type { JournalViewEntry } from "@/lib/journal/view";

/** prev 為 undefined＝剛打開頁面 */
export function shouldScrollToDay(prev: string | null | undefined, next: string | null): boolean {
  return Boolean(next) && next !== prev;
}

export function scrollBehaviorFor(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}

export function dayAnchorId(dateKey: string): string {
  return `journal-day-${dateKey}`;
}

/** 已發生（不含計畫中）的紀錄裡最新的一筆 */
export function latestEntryId(entries: readonly JournalViewEntry[]): string | null {
  const latest = entries
    .filter((entry) => entry.status !== "planned")
    .reduce<JournalViewEntry | null>((best, entry) => (!best || entry.experiencedAt > best.experiencedAt ? entry : best), null);
  return latest?.id ?? null;
}
