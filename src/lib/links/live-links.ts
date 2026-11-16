/** 記一筆場外：把場館類型與手填售票網址寫進場刊（server only，service role） */

import { getServerNotify } from "@/lib/alerts/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { planUserLink } from "./input";
import type { LiveLinkExtras } from "./live-input";

function warn(title: string, detail: string): void {
  console.error(`[links] ${title}`, detail);
  void getServerNotify()("warn", title, detail).catch(() => undefined);
}

/**
 * - 場館類型：只補空的（場外資訊以第一位記下的人為準，與 match.ts 一致）
 * - 售票網址：origin manual、kind ticket；同場刊同售票站已有一筆就不蓋（先寫先贏）；白名單外待審並推警報
 * 失敗推警報但不擋記一筆（日誌已寫入，連結只是附加資訊）。
 */
export async function saveLiveLinkExtras(workId: string, userId: string, extras: LiveLinkExtras): Promise<void> {
  const supabase = createAdminClient();
  if (extras.venueType) {
    const { error } = await supabase
      .from("works")
      .update({ venue_type: extras.venueType })
      .eq("id", workId)
      .is("venue_type", null);
    if (error) warn("場刊場館類型寫入失敗", `work=${workId} ${error.message}`);
  }
  if (!extras.ticketUrl) return;
  const plan = planUserLink({ kind: "ticket", url: extras.ticketUrl, label: null });
  const { error } = await supabase.from("work_links").upsert(
    {
      work_id: workId,
      kind: "ticket",
      source: plan.source,
      label: plan.label,
      url: extras.ticketUrl,
      origin: "manual",
      status: plan.status,
      added_by: userId,
    },
    { onConflict: "work_id,source", ignoreDuplicates: true },
  );
  if (error) {
    warn("場刊售票網址寫入失敗", `work=${workId} ${error.message}`);
    return;
  }
  if (plan.status === "pending") warn("場刊手填了白名單外的售票網址，待審", `work=${workId} source=${plan.source}`);
}
