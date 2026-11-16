/** 讀者補封面的資料存取（server only，service role）：作品存在與否、寫一筆待審／通過紀錄 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CoverSubmissionRow } from "./submit";

export async function workExists(workId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("works").select("id").eq("id", workId).maybeSingle();
  if (error) throw new Error(`讀取作品失敗：${error.message}`);
  return data !== null;
}

export async function insertCoverSubmission(row: CoverSubmissionRow): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("work_cover_submissions")
    .insert({
      work_id: row.workId,
      user_id: row.userId,
      url: row.url,
      source: row.source,
      status: row.status,
      reviewed_at: row.status === "approved" ? now : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`寫入補封面紀錄失敗：${error?.message ?? "沒有回傳 id"}`);
  return (data as { id: string }).id;
}

/** 這位讀者對這部作品有沒有還在待審的封面（場刊「補封面」改顯示「收到了」） */
export async function hasPendingCover(workId: string, userId: string): Promise<boolean> {
  const { count, error } = await createAdminClient()
    .from("work_cover_submissions")
    .select("id", { count: "exact", head: true })
    .eq("work_id", workId)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(`讀取待審封面失敗：${error.message}`);
  return (count ?? 0) > 0;
}
