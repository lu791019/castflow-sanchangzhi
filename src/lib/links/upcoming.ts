/** 日誌「接下來」每列的次鈕（server only）：本人的計畫 → 作品 → 一顆連結 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerNotify } from "@/lib/alerts/notify";
import { loadPrimaryLinks } from "./repository";
import type { WorkLink } from "./types";

/** entryId → 次鈕；沒綁作品或沒連結的不在裡面。失敗推警報並回空（列表照常顯示） */
export async function loadUpcomingLinks(userId: string, entryIds: readonly string[]): Promise<Record<string, WorkLink>> {
  if (entryIds.length === 0) return {};
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("id, work_id")
    .eq("user_id", userId)
    .in("id", [...entryIds])
    .not("work_id", "is", null);
  if (error) {
    console.error("[links] 讀取接下來的作品失敗", error.message);
    void getServerNotify()("warn", "接下來的買票連結讀取失敗", error.message).catch(() => undefined);
    return {};
  }
  const rows = (data ?? []) as Array<{ id: string; work_id: string }>;
  const byWork = await loadPrimaryLinks(rows.map((row) => row.work_id));
  return Object.fromEntries(
    rows.flatMap((row) => {
      const link = byWork.get(row.work_id);
      return link ? [[row.id, link]] : [];
    }),
  );
}
