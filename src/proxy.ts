/**
 * Next.js 16 的 proxy（舊名 middleware；middleware.ts 在 16 已 deprecated，改用 proxy.ts / export proxy）。
 * 1. 刷新 Supabase session cookie
 * 2. 需要登入的頁面：未登入 → /login?next=原路徑
 * 3. 已登入但還沒取筆名 → /onboarding/pen-name?next=原路徑
 * API 不在這裡擋：每個 route handler 自己 requireApiUser()（同時取得 uid 做資料過濾）。
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  isPenNameExemptPath,
  isProtectedPage,
  loginRedirectPath,
  PEN_NAME_PATH,
} from "@/lib/auth/paths";
import { getProfilePenName } from "@/lib/me/pen-name";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

async function hasPenName(userId: string): Promise<boolean> {
  try {
    return Boolean(await getProfilePenName(userId));
  } catch (error) {
    // 讀不到就放行，不因 profiles 查詢失敗把人卡在門外
    console.error("[proxy] pen name check failed", error instanceof Error ? error.message : error);
    return true;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/") || !isProtectedPage(pathname)) return response;

  if (!userId) {
    return redirectWithCookies(response, new URL(loginRedirectPath(pathname, search), request.url));
  }

  if (!isPenNameExemptPath(pathname) && !(await hasPenName(userId))) {
    const target = new URL(PEN_NAME_PATH, request.url);
    target.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(response, target);
  }

  return response;
}

export const config = {
  matcher: [
    // 靜態資源、圖片、service worker、manifest 不需要 session
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
