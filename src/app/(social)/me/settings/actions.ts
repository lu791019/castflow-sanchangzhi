"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { savePublishDefaults, type PublishDefaults } from "@/lib/me/preferences";
import { unsubscribeShow } from "@/lib/me/shows-repository";
import { isUuid } from "@/lib/auth/owned-reads";
import { parseVisibility } from "@/lib/proof/publish";

type ActionResult = { ok: true } | { ok: false; error: string };

async function savePatch(patch: Partial<PublishDefaults>): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  try {
    await savePublishDefaults(userId, patch);
    revalidatePath("/me/settings");
    return { ok: true };
  } catch (error) {
    console.error("[settings] savePublishDefaults failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "沒有存進去，稍後再試一次" };
  }
}

/** 預設公開範圍：之後新說的每一篇都從這個開始，校樣頁還能逐篇改 */
export async function saveDefaultVisibilityAction(value: unknown): Promise<ActionResult> {
  const visibility = parseVisibility(value);
  if (!visibility) return { ok: false, error: "公開範圍不正確" };
  return savePatch({ defaultVisibility: visibility });
}

/** 發佈時一起寫好社群貼文（總開關） */
export async function saveGenerateSocialAction(value: unknown): Promise<ActionResult> {
  if (typeof value !== "boolean") return { ok: false, error: "設定不正確" };
  return savePatch({ generateSocial: value });
}

/** 取消訂閱自己的節目 */
export async function unsubscribeShowAction(feedId: unknown): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  if (typeof feedId !== "string" || !isUuid(feedId)) return { ok: false, error: "找不到這個節目" };
  try {
    const removed = await unsubscribeShow(userId, feedId);
    if (!removed) return { ok: false, error: "找不到這個節目" };
    revalidatePath("/me/settings");
    revalidatePath("/me/settings/shows");
    return { ok: true };
  } catch (error) {
    console.error("[settings] unsubscribe failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "沒有取消成功，稍後再試一次" };
  }
}
