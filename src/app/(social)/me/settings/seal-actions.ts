"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { saveSealGlyph } from "@/lib/seal/glyph-repository";

type ActionResult = { ok: true; glyph: string | null } | { ok: false; error: string };

/** 印文用字：限筆名中的字（server 依 DB 裡的筆名驗證）；null＝回到依規則 */
export async function saveSealGlyphAction(value: unknown): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  try {
    const result = await saveSealGlyph(userId, value);
    if (!result.ok) return result;
    revalidatePath("/me/settings");
    revalidatePath("/me");
    return { ok: true, glyph: result.value };
  } catch (error) {
    console.error("[settings] saveSealGlyph failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "沒有存進去，稍後再試一次" };
  }
}
