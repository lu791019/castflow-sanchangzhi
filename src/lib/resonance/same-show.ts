/**
 * 同場的人（server only）：同一作品、時間窗內「以筆名署名＋公開發佈」的說一段。
 * - 文章頁：近 7 天、排除文章作者本人、≤8 位（sameShow.window / sameShow.row）
 * - 作品特輯：本週（週一起），由 feature-repository 自己算
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { pickCast, type CastCandidate, type CastMember } from "./feature";
import { loadProfilePenNames, PUBLIC_PEN_NAME_FILTER } from "./public-authors";
import { lastSevenDaysStart } from "./week";

export const SAME_SHOW_LIMIT = 8;
const QUERY_LIMIT = 200;

interface SameShowRow {
  user_id: string;
  created_at: string;
  share_slug: string;
  pull_quote: string | null;
}

/** 同作品、since 之後說的公開筆名文章（每人可能多篇，由 pickCast 去重） */
export async function loadCastCandidates(workId: string, since: Date): Promise<CastCandidate[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("user_id, created_at, share_slug, pull_quote")
    .eq("work_id", workId)
    .eq("visibility", PUBLIC_PEN_NAME_FILTER.visibility)
    .eq("byline", PUBLIC_PEN_NAME_FILTER.byline)
    .not("published_at", "is", null)
    .not("share_slug", "is", null)
    .neq("source", "rss")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(QUERY_LIMIT);
  if (error) {
    console.error("[resonance] loadCastCandidates failed", { workId, message: error.message });
    return [];
  }
  const rows = (data ?? []) as SameShowRow[];
  const penNames = await loadProfilePenNames(rows.map((row) => row.user_id));
  return rows.map((row) => ({
    userId: row.user_id,
    penName: penNames.get(row.user_id) ?? null,
    saidAt: row.created_at,
    shareSlug: row.share_slug,
    pullQuote: row.pull_quote,
  }));
}

/** 文章頁頁尾「這週也看了《X》的人」 */
export async function loadArticleSameShow(
  workId: string,
  authorId: string,
  now: Date,
): Promise<CastMember[]> {
  const since = lastSevenDaysStart(now);
  const candidates = await loadCastCandidates(workId, since);
  return pickCast(candidates, { since, exclude: authorId, limit: SAME_SHOW_LIMIT });
}
