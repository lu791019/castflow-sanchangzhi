/**
 * 社群呈現的身分過濾（server only）。
 * 只有「以筆名署名＋公開發佈」的文章參與同場、共鳴來源名單；匿名署名、不公開、未發佈的一律不出現。
 * 筆名只讀 profiles（不退回舊的單人設定），沒有筆名就不露名字、不露印章。
 */

import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 公開＋筆名署名＋已發佈＋有分享網址＋不是 RSS 原始集數（作品素材，不是聽眾的感受） */
export const PUBLIC_PEN_NAME_FILTER = {
  visibility: "public",
  byline: "pen_name",
} as const;

/** user_id → 筆名（只有真的取了筆名的人） */
export async function loadProfilePenNames(userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter((id) => UUID_PATTERN.test(id));
  const result = new Map<string, string>();
  if (ids.length === 0) return result;
  const { data, error } = await createAdminClient().from("profiles").select("id, pen_name").in("id", ids);
  if (error) {
    console.error("[resonance] loadProfilePenNames failed", { message: error.message });
    return result;
  }
  for (const row of (data ?? []) as Array<{ id: string; pen_name: string | null }>) {
    if (row.pen_name) result.set(row.id, row.pen_name);
  }
  return result;
}

/** 這些人之中，至少有一篇「筆名署名＋公開發佈」文章的 → 筆名；其餘不點名 */
export async function loadPublicAuthorNames(userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter((id) => UUID_PATTERN.test(id));
  if (ids.length === 0) return new Map();
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("user_id")
    .in("user_id", ids)
    .eq("visibility", PUBLIC_PEN_NAME_FILTER.visibility)
    .eq("byline", PUBLIC_PEN_NAME_FILTER.byline)
    .not("published_at", "is", null)
    .not("share_slug", "is", null)
    .neq("source", "rss")
    .limit(1000);
  if (error) {
    console.error("[resonance] loadPublicAuthorNames failed", { message: error.message });
    return new Map();
  }
  const publicIds = [...new Set((data ?? []).map((row) => row.user_id as string))];
  return loadProfilePenNames(publicIds);
}
