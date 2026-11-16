/**
 * 說一段作品卡的資料讀取（server only，service role，一律限定 userId）。
 * 查詢失敗要警報，不靜默回空（UX-07）。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { loadJournalForSay } from "@/lib/journal/say-context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RecentWork } from "@/app/(social)/say/say-stage";
import { episodeCard, type RecentEpisodeRow } from "./cards";
import { toJournalPrefill } from "./journal-prefill";

/** 「剛記」的範圍：一週內記下、還沒說也沒略過的紀錄 */
export const UNSAID_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_EPISODES_LIMIT = 5;

async function warn(title: string, detail: string): Promise<void> {
  await getServerNotify()("warn", title, detail).catch(() => undefined);
}

/** 最近一筆還沒說的日誌（已發生、未連到文章）；沒有回 null */
export async function loadLatestUnsaid(userId: string, now: Date = new Date()): Promise<RecentWork | null> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "recorded")
    .is("episode_id", null)
    .lte("experienced_at", now.toISOString())
    .gte("experienced_at", new Date(now.getTime() - UNSAID_WINDOW_MS).toISOString())
    .order("experienced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    await warn("說一段：讀取還沒說的日誌失敗", `user=${userId} ${error.message}`);
    return null;
  }
  if (!data) return null;
  const context = await loadJournalForSay(userId, data.id as string);
  return context ? toJournalPrefill(context) : null;
}

/** 最近說過、有綁作品的文章 */
export async function loadRecentEpisodeCards(userId: string): Promise<RecentWork[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id, title, created_at, work_id, works(kind, title, podcast_show, poster_url)")
    .eq("user_id", userId)
    .neq("source", "rss")
    .not("work_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_EPISODES_LIMIT);
  if (error) {
    await warn("說一段：讀取最近說過的作品失敗", `user=${userId} ${error.message}`);
    return [];
  }
  return ((data ?? []) as unknown as RecentEpisodeRow[]).flatMap((row) => {
    const card = episodeCard(row);
    return card ? [card] : [];
  });
}
