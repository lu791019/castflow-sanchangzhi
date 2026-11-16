"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { saveColumnName } from "@/lib/me/column-name-repository";

type ActionResult = { ok: true; columnName: string | null } | { ok: false; error: string };

/** 專欄名：以 session 的 userId 寫入（不收 client 傳來的身分）；空字串＝清掉 */
export async function saveColumnNameAction(value: unknown): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  try {
    const result = await saveColumnName(userId, value);
    if (!result.ok) return result;
    revalidatePath("/me/settings");
    revalidatePath("/me");
    revalidatePath("/catalog");
    return { ok: true, columnName: result.value };
  } catch (error) {
    console.error("[settings] saveColumnName failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "沒有存進去，稍後再試一次" };
  }
}
