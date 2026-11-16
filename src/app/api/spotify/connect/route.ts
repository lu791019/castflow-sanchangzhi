import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { loginRedirectPath } from "@/lib/auth/paths";
import { spotifyListenEnabled } from "@/lib/features";
import { newOAuthState, settingsUrl, SPOTIFY_SETTINGS_PATH, SPOTIFY_STATE_COOKIE, SPOTIFY_STATE_MAX_AGE_SECONDS } from "@/lib/spotify/connect";
import { warnSpotify } from "@/lib/spotify/connection-repository";
import { serverRedirectUri, spotifyUserDepsFromEnv } from "@/lib/spotify/server";
import { authorizeUrl } from "@/lib/spotify/user-api";

export const dynamic = "force-dynamic";

/**
 * 設定頁「連結 Spotify」（Q-64 C1）：產生 state 放 httpOnly cookie（10 分鐘、只送回 /api/spotify），導到 Spotify 授權頁。
 * 功能開關 FEATURE_SPOTIFY_LISTEN 關 → 404；未登入 → 登入頁；沒設金鑰 → 回設定頁顯示暫停並推警報。
 */
export async function GET(request: NextRequest) {
  if (!spotifyListenEnabled()) return NextResponse.json({ success: false, error: "找不到" }, { status: 404 });
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.redirect(new URL(loginRedirectPath(SPOTIFY_SETTINGS_PATH, ""), request.url));
  const deps = spotifyUserDepsFromEnv();
  if (!deps) {
    warnSpotify("Spotify 連結停用：沒有 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET", `user=${userId}`);
    return NextResponse.redirect(new URL(settingsUrl("unavailable"), request.url));
  }
  const redirectUri = serverRedirectUri();
  const state = newOAuthState();
  const response = NextResponse.redirect(
    authorizeUrl({ clientId: deps.credentials.clientId, redirectUri, state, accountsBase: deps.urls.accountsBase }),
  );
  response.cookies.set(SPOTIFY_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    path: "/api/spotify",
    maxAge: SPOTIFY_STATE_MAX_AGE_SECONDS,
  });
  return response;
}
