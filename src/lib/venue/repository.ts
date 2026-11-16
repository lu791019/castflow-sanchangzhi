/** 場外作品的建立與重用（server only，service role）：記一筆場外變體由這裡決定歸入哪一本場刊 */

import { createAdminClient } from "@/lib/supabase/admin";
import { manualWorkInsert } from "@/lib/work-picker/work-rows";
import type { LiveJournalInput } from "./input";
import { pickProgramme, toDayRange, type ProgrammeCandidate } from "./match";

/** 同名候選最多看幾本（同名巡演、年年辦的音樂祭） */
const CANDIDATE_LIMIT = 50;
const CANDIDATE_COLUMNS = "id, kind, live_key, event_date, event_end_date, issue_no";

export interface LiveWorkRef {
  id: string;
  slug: string;
  created: boolean;
}

async function findCandidates(input: LiveJournalInput): Promise<ProgrammeCandidate[]> {
  const { data, error } = await createAdminClient()
    .from("works")
    .select(CANDIDATE_COLUMNS)
    .eq("kind", input.kind)
    .eq("live_key", input.key)
    .order("issue_no", { ascending: true })
    .limit(CANDIDATE_LIMIT);
  if (error) {
    console.error("[venue] findCandidates failed", { kind: input.kind, message: error.message });
    throw new Error("查場刊失敗");
  }
  return (data ?? []) as ProgrammeCandidate[];
}

async function slugOf(id: string): Promise<string> {
  const { data, error } = await createAdminClient().from("works").select("slug").eq("id", id).single();
  if (error) throw new Error(`讀取場刊失敗：${error.message}`);
  return data.slug as string;
}

/**
 * 同類型＋同名（正規化）＋日期相近（見 match.ts）→ 回既有場刊；否則以這筆手寫資料建新的一本。
 * 已知限制：兩人同一瞬間記同一場可能各建一本（沒有鎖），之後可由後台合併。
 */
export async function findOrCreateLiveWork(input: LiveJournalInput): Promise<LiveWorkRef> {
  const hit = pickProgramme(await findCandidates(input), {
    kind: input.kind,
    key: input.key,
    range: toDayRange(input.dates),
  });
  if (hit) return { id: hit.id, slug: await slugOf(hit.id), created: false };

  const row = {
    ...manualWorkInsert(
      { kind: input.kind, title: input.name, venue: input.venue, eventDate: input.dates.start },
      Date.now(),
    ),
    event_end_date: input.dates.end,
    live_key: input.key,
  };
  const { data, error } = await createAdminClient().from("works").insert(row).select("id, slug").single();
  if (error) {
    console.error("[venue] insert live work failed", { kind: input.kind, message: error.message });
    throw new Error("建立場刊失敗");
  }
  return { id: data.id as string, slug: data.slug as string, created: true };
}
