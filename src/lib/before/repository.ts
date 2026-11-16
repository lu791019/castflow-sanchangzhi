/** 散場之前：社群場刊（演出、展覽）今天起 30 天內（server only，service role；作品是公開資料，不帶任何使用者資訊） */

import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_LIMITS, liveWindow, type LiveWorkRow } from "./cards";

const LIVE_COLUMNS = "id, slug, kind, title, venue, event_date, event_end_date, poster_url";

/** 檔期和 [今天, 今天＋30] 有交集：開始日不晚於窗尾，且結束日（沒有就用開始日）不早於今天；日期近的在前 */
export async function listUpcomingLiveWorks(today: string): Promise<LiveWorkRow[]> {
  const { from, to } = liveWindow(today);
  const { data, error } = await createAdminClient()
    .from("works")
    .select(LIVE_COLUMNS)
    .in("kind", ["live", "exhibition"])
    .not("event_date", "is", null)
    .lte("event_date", to)
    .or(`event_end_date.gte.${from},and(event_end_date.is.null,event_date.gte.${from})`)
    .order("event_date", { ascending: true })
    .limit(CARD_LIMITS.live);
  if (error) throw new Error(`讀取場外活動失敗：${error.message}`);
  return (data ?? []) as LiveWorkRow[];
}
