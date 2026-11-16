/**
 * `/say?journal=<id>`：把視聽日誌紀錄轉成說一段的預帶作品卡
 * （與 `/say?work=<slug>` 同一套 RecentWork 顯示）。
 */

import type { RecentWork } from "@/app/(social)/say/say-stage";
import type { JournalSayContext } from "@/lib/journal/say-context";
import { VENUE_LABELS } from "@/lib/journal/types";
import { KIND_LABELS } from "@/lib/works/format";

export const JOURNAL_PREFILL_NOTE = "來自你的視聽日誌";

export function toJournalPrefill(context: JournalSayContext): RecentWork {
  const { entry, work, workTitle, verb } = context;
  const podcast = work?.kind === "podcast_episode";
  return {
    id: entry.id,
    workId: entry.work_id,
    journalId: entry.id,
    title: workTitle || "這次的紀錄",
    workTitle: workTitle || null,
    categoryLabel: work ? KIND_LABELS[work.kind] : VENUE_LABELS[entry.venue],
    // 用看完的時刻，作品卡上方顯示「散場後 n 小時」；排行程的用估計散場時間（散場提醒點進來不會顯示「散場後 2 小時」）
    createdAt: context.settleAt ?? entry.experienced_at,
    verb: verb === "聽完" ? "聽" : "看",
    note: podcast && work ? work.title : JOURNAL_PREFILL_NOTE,
    posterUrl: work?.poster_url ?? null,
  };
}
