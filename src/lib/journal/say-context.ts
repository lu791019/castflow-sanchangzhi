/**
 * `/say?journal=<id>` 的資料讀取（給之後「說一段」接線用；say 頁本身尚未改）。
 * 回傳預帶作品卡與署名時間差所需的一切：紀錄本身、作品、顯示名稱、動詞。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_COLUMNS, type Work } from "@/lib/works/format";
import { defaultVerb } from "./remind";
import { estimateSettleAt } from "./settle";
import { isPlannedAhead } from "./settle-due";
import { JOURNAL_COLUMNS, UUID_PATTERN, type JournalEntry } from "./types";

export interface JournalSayContext {
  entry: JournalEntry;
  work: Work | null;
  /** 作品卡顯示名：Podcast 用節目名，否則作品名，再退回只記名稱 */
  workTitle: string;
  /** 看完／聽完 */
  verb: string;
  /** 已說過或已略過仍可開，但 UI 可據此提示 */
  alreadySaid: boolean;
  /** 排行程的條目：估計的散場時間（散場提醒點進來時，「散場後 n 分鐘」從這裡算）；其餘 null */
  settleAt?: string | null;
}

function settleAtOf(entry: JournalEntry, work: Work | null, runtimeMinutes: number | null): string | null {
  if (!isPlannedAhead(entry)) return null;
  const settleAt = estimateSettleAt(entry, work ? { kind: work.kind, runtime_minutes: runtimeMinutes } : null);
  return settleAt ? settleAt.toISOString() : null;
}

export function toSayContext(entry: JournalEntry, work: Work | null, runtimeMinutes: number | null = null): JournalSayContext {
  const podcast = work?.kind === "podcast_episode";
  const listen = podcast || work?.kind === "music";
  const workTitle =
    (podcast && work?.podcast_show) || work?.title || entry.work_title_fallback || "";
  return {
    entry,
    work,
    workTitle,
    verb: listen ? "聽完" : defaultVerb(entry.venue),
    alreadySaid: entry.status === "said",
    settleAt: settleAtOf(entry, work, runtimeMinutes),
  };
}

export async function loadJournalForSay(
  userId: string,
  journalId: string | null | undefined,
): Promise<JournalSayContext | null> {
  if (!journalId || !UUID_PATTERN.test(journalId)) return null;
  const supabase = createAdminClient();
  const { data: entry, error } = await supabase
    .from("journal_entries")
    .select(JOURNAL_COLUMNS)
    .eq("id", journalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[journal] loadJournalForSay failed", { journalId, message: error.message });
    return null;
  }
  if (!entry) return null;

  const typed = entry as JournalEntry;
  if (!typed.work_id) return toSayContext(typed, null);

  const { data: work, error: workError } = await supabase
    .from("works")
    .select(`${WORK_COLUMNS}, runtime_minutes`)
    .eq("id", typed.work_id)
    .maybeSingle();
  if (workError) {
    console.error("[journal] load work failed", { workId: typed.work_id, message: workError.message });
  }
  const row = (work as (Work & { runtime_minutes?: number | null }) | null) ?? null;
  return toSayContext(typed, row, row?.runtime_minutes ?? null);
}
