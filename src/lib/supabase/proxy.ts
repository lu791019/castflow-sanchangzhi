import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export interface SessionResult {
  /** 帶著刷新後 cookie 的回應；若要改回 redirect，必須沿用它的 cookie */
  response: NextResponse;
  userId: string | null;
}

/**
 * @supabase/ssr 官方 Next.js pattern：每個請求刷新 session，並把新 cookie 同步寫回
 * request（給後面的 server component）與 response（給瀏覽器）。
 * createServerClient 與 getUser() 之間不可插入其他邏輯，否則 session 可能被隨機登出。
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  return { response, userId: data.user?.id ?? null };
}

/** redirect 時把刷新後的 session cookie 一併帶上 */
export function redirectWithCookies(from: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
