/**
 * 記一筆「最近說過／記過的」作品列（server only）：
 * 日誌紀錄與說一段的作品依時間合併、去重，最多 5 個（第一格固定是搜尋）。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkKind } from "@/lib/works/format";

export const RECENT_LOG_WORKS_MAX = 5;
const SCAN_LIMIT = 30;

export interface RecentLogWork {
  id: string;
  kind: WorkKind;
  title: string;
  podcast_show: string | null;
  episode_number: number | null;
  poster_url: string | null;
}

interface TimedWorkId {
  workId: string;
  at: string;
}

/** 依時間新到舊合併兩個來源並去重（純函式） */
export function mergeRecentWorkIds(
  sources: ReadonlyArray<readonly TimedWorkId[]>,
  limit = RECENT_LOG_WORKS_MAX,
): string[] {
  const sorted = sources.flat().sort((a, b) => b.at.localeCompare(a.at));
  return [...new Set(sorted.map((item) => item.workId))].slice(0, limit);
}

export async function listRecentLogWorks(userId: string): Promise<RecentLogWork[]> {
  const supabase = createAdminClient();
  const [journal, episodes] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("work_id, created_at")
      .eq("user_id", userId)
      .not("work_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(SCAN_LIMIT),
    supabase
      .from("episodes")
      .select("work_id, created_at")
      .eq("user_id", userId)
      .not("work_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(SCAN_LIMIT),
  ]);
  if (journal.error) throw new Error(`讀取最近記過的作品失敗：${journal.error.message}`);
  if (episodes.error) throw new Error(`讀取最近說過的作品失敗：${episodes.error.message}`);

  const toTimed = (rows: Array<{ work_id: string | null; created_at: string }> | null) =>
    (rows ?? []).flatMap((row) => (row.work_id ? [{ workId: row.work_id, at: row.created_at }] : []));
  const ids = mergeRecentWorkIds([toTimed(journal.data), toTimed(episodes.data)]);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("works")
    .select("id, kind, title, podcast_show, episode_number, poster_url")
    .in("id", ids);
  if (error) throw new Error(`讀取作品失敗：${error.message}`);
  const byId = new Map(((data ?? []) as RecentLogWork[]).map((work) => [work.id, work]));
  return ids.flatMap((id) => {
    const work = byId.get(id);
    return work ? [work] : [];
  });
}
