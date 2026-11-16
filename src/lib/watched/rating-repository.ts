/** 作品的星等（匿名彙總用；user_id 只拿來每人取一筆，不往外傳） */

import { createAdminClient } from "@/lib/supabase/admin";
import { latestRatingPerUser, summarizeRatings, type RatingRow, type RatingSummary } from "./rating-summary";

const MAX_RATINGS = 5000;

export async function loadWorkRatingSummary(workId: string): Promise<RatingSummary> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("user_id, rating, created_at")
    .eq("work_id", workId)
    .not("rating", "is", null)
    .limit(MAX_RATINGS);
  if (error) throw new Error(`讀取作品星等失敗：${error.message}`);
  return summarizeRatings(latestRatingPerUser((data ?? []) as RatingRow[]));
}
