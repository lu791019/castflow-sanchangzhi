import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/session";
import { DEFAULT_PEN_NAME, penNameFromSetting } from "@/lib/proof/publish";

export const AUTHOR_PROFILE_KEY = "author_profile";

const PG_UNIQUE_VIOLATION = "23505";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 單人時期的筆名（settings.author_profile.pen_name）；profiles 沒有筆名時的相容 fallback */
async function loadLegacyPenName(): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("settings")
    .select("value")
    .eq("key", AUTHOR_PROFILE_KEY)
    .maybeSingle();
  if (error) {
    console.error("[me] loadLegacyPenName failed", { message: error.message });
    return DEFAULT_PEN_NAME;
  }
  return penNameFromSetting(data?.value);
}

/** profiles.pen_name；沒有列、沒取筆名、或 id 不是 uuid（舊資料 'default'）回 null */
export async function getProfilePenName(userId: string): Promise<string | null> {
  if (!UUID_PATTERN.test(userId)) return null;
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("pen_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`讀取筆名失敗：${error.message}`);
  return (data?.pen_name as string | null | undefined) ?? null;
}

/**
 * 筆名：
 * - 傳 ownerId（文章作者的 user_id）→ 讀該作者；分享頁、作品特輯用這個，不能讀「正在看的人」。
 * - 不傳 → 目前登入者。
 * profiles 沒有筆名時退回舊 settings（相容單人時期），再沒有用「作者」。
 */
export async function loadPenName(ownerId?: string | null): Promise<string> {
  const userId = ownerId === undefined ? await getCurrentUserId() : ownerId;
  if (userId) {
    try {
      const penName = await getProfilePenName(userId);
      if (penName) return penName;
    } catch (error) {
      console.error("[me] loadPenName failed", { message: error instanceof Error ? error.message : error });
    }
  }
  return loadLegacyPenName();
}

/** 多位作者一次讀（作品特輯）：回傳 user_id → 筆名 */
export async function loadPenNames(ownerIds: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ownerIds)];
  const uuids = unique.filter((id) => UUID_PATTERN.test(id));
  const result = new Map<string, string>();
  if (uuids.length > 0) {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("id, pen_name")
      .in("id", uuids);
    if (error) console.error("[me] loadPenNames failed", { message: error.message });
    for (const row of (data ?? []) as Array<{ id: string; pen_name: string | null }>) {
      if (row.pen_name) result.set(row.id, row.pen_name);
    }
  }
  if (unique.some((id) => !result.has(id))) {
    const legacy = await loadLegacyPenName();
    for (const id of unique) if (!result.has(id)) result.set(id, legacy);
  }
  return result;
}

/** 筆名是否可用（大小寫視為不同，與 DB unique 一致）；自己目前的筆名算可用 */
export async function isPenNameAvailable(penName: string, userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("pen_name", penName)
    .maybeSingle();
  if (error) throw new Error(`檢查筆名失敗：${error.message}`);
  return !data || data.id === userId;
}

export type SavePenNameResult = { ok: true } | { ok: false; reason: "taken" };

export async function savePenName(userId: string, penName: string): Promise<SavePenNameResult> {
  const { error } = await createAdminClient()
    .from("profiles")
    .upsert({ id: userId, pen_name: penName }, { onConflict: "id" });
  if (error?.code === PG_UNIQUE_VIOLATION) return { ok: false, reason: "taken" };
  if (error) throw new Error(`儲存筆名失敗：${error.message}`);
  return { ok: true };
}
