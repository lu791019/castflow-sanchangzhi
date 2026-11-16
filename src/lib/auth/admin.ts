/**
 * 站長（instance owner）= 認領單人時期舊資料的那個人（settings.legacy_claim.user_id）。
 * 全站共用的設定（Meta token、AI 金鑰）還沒有分使用者，只允許站長讀寫，避免其他使用者看到或覆蓋。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { LEGACY_CLAIM_KEY } from "./claim";

export async function isSiteOwner(userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("settings")
    .select("value")
    .eq("key", LEGACY_CLAIM_KEY)
    .maybeSingle();
  if (error) {
    console.error("[auth] isSiteOwner failed", error.message);
    return false;
  }
  return (data?.value as { user_id?: unknown } | undefined)?.user_id === userId;
}
