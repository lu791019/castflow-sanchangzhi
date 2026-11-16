/**
 * 認領單人時期的舊資料（user_id='default'）。
 * 真正的搬移在 DB 函式 claim_legacy_data（013，單一 transaction + advisory lock，只有 service role 可呼叫）。
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const LEGACY_CLAIM_KEY = "legacy_claim";

export type ClaimResult =
  | { claimed: true; total: number; counts: Record<string, number> }
  | { claimed: false; reason: "already_claimed" | "invalid_response" };

function isCountMap(value: unknown): value is Record<string, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((n) => typeof n === "number")
  );
}

export function parseClaimResult(value: unknown): ClaimResult {
  if (typeof value !== "object" || value === null) return { claimed: false, reason: "invalid_response" };
  const raw = value as { claimed?: unknown; counts?: unknown; reason?: unknown };
  if (raw.claimed === true && isCountMap(raw.counts)) {
    const total = Object.values(raw.counts).reduce((sum, n) => sum + n, 0);
    return { claimed: true, total, counts: raw.counts };
  }
  if (raw.claimed === false && raw.reason === "already_claimed") {
    return { claimed: false, reason: "already_claimed" };
  }
  return { claimed: false, reason: "invalid_response" };
}

/** 還能認領嗎：沒有 legacy_claim 旗標，且確實有 'default' 的舊文章 */
export async function isLegacyClaimable(): Promise<boolean> {
  const supabase = createAdminClient();
  const [flag, legacy] = await Promise.all([
    supabase.from("settings").select("key").eq("key", LEGACY_CLAIM_KEY).maybeSingle(),
    supabase.from("episodes").select("id", { count: "exact", head: true }).eq("user_id", "default"),
  ]);
  if (flag.error) throw new Error(`讀取認領狀態失敗：${flag.error.message}`);
  if (legacy.error) throw new Error(`讀取舊資料失敗：${legacy.error.message}`);
  return !flag.data && (legacy.count ?? 0) > 0;
}

export async function claimLegacyData(userId: string): Promise<ClaimResult> {
  const { data, error } = await createAdminClient().rpc("claim_legacy_data", { p_uid: userId });
  if (error) throw new Error(`認領舊資料失敗：${error.message}`);
  return parseClaimResult(data);
}
