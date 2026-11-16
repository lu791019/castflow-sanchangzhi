"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { claimLegacyData, isLegacyClaimable } from "@/lib/auth/claim";
import { authEmailBlocked } from "@/lib/e2e-overrides";
import { safeNextPath } from "@/lib/auth/paths";
import { validatePenName } from "@/lib/auth/pen-name-rules";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { savePenName } from "@/lib/me/pen-name";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "127.0.0.1:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** 寄 magic link：信中連結回到 /auth/callback?next=… 交換 session（PKCE，verifier 存在這個瀏覽器的 cookie） */
export async function sendMagicLinkAction(input: { email: unknown; next?: unknown }): Promise<ActionResult> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "這個 email 看起來不太對，再檢查一下" };
  }
  const next = safeNextPath(typeof input.next === "string" ? input.next : null);
  const callback = new URL("/auth/callback", await requestOrigin());
  callback.searchParams.set("next", next);

  if (authEmailBlocked()) {
    // E2E 對雲端跑：不真的寄信（見 lib/e2e-overrides）
    console.error("[auth] signInWithOtp blocked (E2E_BLOCK_AUTH_EMAIL=on)");
    return { ok: false, error: "測試環境不寄登入信" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
  });
  if (error) {
    console.error("[auth] signInWithOtp failed", { status: error.status, message: error.message });
    return {
      ok: false,
      error: error.status === 429 ? "寄太多次了，稍等一下再試" : "連結寄不出去，稍後再試一次",
    };
  }
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[auth] signOut failed", error.message);
  redirect("/");
}

/** 取筆名；成功後回傳是否還能認領舊資料（由頁面決定要不要問） */
export async function setPenNameAction(
  rawPenName: unknown,
): Promise<ActionResult<{ penName: string; claimable: boolean }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const parsed = validatePenName(rawPenName);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    const saved = await savePenName(userId, parsed.value);
    if (!saved.ok) return { ok: false, error: "這個筆名有人用了，換一個試試" };
    return { ok: true, penName: parsed.value, claimable: await isLegacyClaimable() };
  } catch (error) {
    console.error("[auth] setPenName failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "筆名存不進去，稍後再試一次" };
  }
}

/** 認領單人時期的舊資料（只有第一個人能成功；之後永遠回 already_claimed） */
export async function claimLegacyDataAction(): Promise<ActionResult<{ total: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  try {
    const result = await claimLegacyData(userId);
    if (!result.claimed) {
      return {
        ok: false,
        error: result.reason === "already_claimed" ? "舊資料已經被接走了" : "認領失敗，稍後再試",
      };
    }
    return { ok: true, total: result.total };
  } catch (error) {
    console.error("[auth] claimLegacyData failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "認領失敗，稍後再試" };
  }
}
