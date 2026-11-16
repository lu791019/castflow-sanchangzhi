import { NextRequest, NextResponse } from "next/server";
import { parseEmailLink } from "@/lib/auth/email-link";
import { PEN_NAME_PATH, safeNextPath } from "@/lib/auth/paths";
import { getProfilePenName } from "@/lib/me/pen-name";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 以瀏覽器實際打來的 host 組 redirect（dev server 的 request.url 可能是 localhost，
 * 而 session cookie 寫在 127.0.0.1，host 不同 cookie 就帶不過去）
 */
function siteOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/**
 * 登入信回跳（cookie 由 server client 寫入），沒筆名先去取筆名。
 * 新版信帶 token_hash（verifyOtp，任何瀏覽器都能登入）；舊版信帶 PKCE code（只能在寄信的瀏覽器換 session）。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const link = parseEmailLink(searchParams);
  const origin = siteOrigin(request);
  const failed = new URL("/login", origin);
  failed.searchParams.set("next", next);
  failed.searchParams.set("error", "link");

  if (link.kind === "none") return NextResponse.redirect(failed);

  const supabase = await createClient();
  const { data, error } =
    link.kind === "otp"
      ? await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await supabase.auth.exchangeCodeForSession(link.code);
  if (error || !data.user) {
    console.error(`[auth] ${link.kind === "otp" ? "verifyOtp" : "exchangeCodeForSession"} failed`, error?.message);
    return NextResponse.redirect(failed);
  }

  let penName: string | null = null;
  try {
    penName = await getProfilePenName(data.user.id);
  } catch (lookupError) {
    console.error("[auth] pen name lookup failed", lookupError instanceof Error ? lookupError.message : lookupError);
  }
  if (!penName) {
    const target = new URL(PEN_NAME_PATH, origin);
    target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }
  return NextResponse.redirect(new URL(next, origin));
}
