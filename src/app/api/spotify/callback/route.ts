import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { spotifyListenEnabled } from "@/lib/features";
import { handleSpotifyCallback, settingsUrl, SPOTIFY_STATE_COOKIE } from "@/lib/spotify/connect";
import { saveSpotifyConnection, warnSpotify } from "@/lib/spotify/connection-repository";
import { serverRedirectUri, spotifyUserDepsFromEnv } from "@/lib/spotify/server";
import { exchangeCode, fetchRecentlyPlayed } from "@/lib/spotify/user-api";

export const dynamic = "force-dynamic";

/**
 * Spotify 授權回來（Q-64 C1）：state 對 cookie（防 CSRF）→ 伺服器端用 secret 換權杖 → 試打一次最近播放（不在允許名單 403）
 * → refresh token 加密存 spotify_connections → 回設定頁帶結果（?spotify=connected|denied|not_allowed|…）。cookie 用完即刪。
 */
export async function GET(request: NextRequest) {
  if (!spotifyListenEnabled()) return NextResponse.json({ success: false, error: "找不到" }, { status: 404 });
  const params = request.nextUrl.searchParams;
  const deps = spotifyUserDepsFromEnv();
  const userId = await getCurrentUserId();
  const result = deps
    ? await handleSpotifyCallback(
        {
          code: params.get("code"),
          state: params.get("state"),
          error: params.get("error"),
          cookieState: request.cookies.get(SPOTIFY_STATE_COOKIE)?.value ?? null,
          userId,
        },
        {
          exchange: (code) => exchangeCode(code, serverRedirectUri(), deps),
          probe: (accessToken) => fetchRecentlyPlayed(accessToken, deps),
          save: saveSpotifyConnection,
          warn: warnSpotify,
        },
      )
    : "unavailable";
  if (!deps) warnSpotify("Spotify 連結停用：沒有 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET", `user=${userId ?? "未登入"}`);
  const response = NextResponse.redirect(new URL(settingsUrl(result), request.url));
  response.cookies.set(SPOTIFY_STATE_COOKIE, "", { path: "/api/spotify", maxAge: 0 });
  return response;
}
