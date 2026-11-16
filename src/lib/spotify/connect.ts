/**
 * 設定頁「連結 Spotify」（Q-64 C1）的 OAuth 流程（依賴注入，純流程可測；路由在 app/api/spotify/*）：
 * - connect：產生 state（隨機 24 bytes）放 httpOnly cookie，導到 Spotify 授權頁（scope 只要 user-read-recently-played）
 * - callback：state 要跟 cookie 一致（防 CSRF）、要是登入中的人；code 在伺服器端用 secret 換權杖；
 *   換到後先打一次最近播放確認拿得到（開發模式只有允許名單內的人拿得到，其他人 403 → 不存、顯示「測試階段名額有限」）；
 *   refresh token 加密後才存（token-crypto.ts）。
 * - 結果用 /me/settings?spotify=<結果> 帶回設定頁顯示文案。
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ConnectResult } from "./connect-copy.ts";
import { TokenKeyError } from "./token-crypto.ts";
import { isNotAllowlisted, type UserTokens } from "./user-api.ts";

export { CONNECT_MESSAGES, CONNECT_RESULTS, isConnectResult, settingsUrl, SPOTIFY_SETTINGS_PATH, type ConnectResult } from "./connect-copy.ts";

export const SPOTIFY_STATE_COOKIE = "castflow_spotify_state";
export const SPOTIFY_STATE_MAX_AGE_SECONDS = 10 * 60;
export const SPOTIFY_CALLBACK_PATH = "/api/spotify/callback";

export function newOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function sameState(fromQuery: string | null, fromCookie: string | null): boolean {
  if (!fromQuery || !fromCookie) return false;
  const a = Buffer.from(fromQuery);
  const b = Buffer.from(fromCookie);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Env = Readonly<Record<string, string | undefined>>;

/** 必須跟 Spotify 後台登記的一字不差：正式站 https://castflow.daydreamdex.com/api/spotify/callback、本機 http://127.0.0.1:3000/… */
export function spotifyRedirectUri(siteOrigin: string, env: Env = process.env): string {
  const explicit = env.SPOTIFY_REDIRECT_URI?.trim();
  return explicit || `${siteOrigin.replace(/\/$/, "")}${SPOTIFY_CALLBACK_PATH}`;
}

export interface CallbackInput {
  code: string | null;
  state: string | null;
  /** Spotify 帶回的 error（使用者按取消＝access_denied） */
  error: string | null;
  cookieState: string | null;
  userId: string | null;
}

export interface CallbackDeps {
  exchange: (code: string) => Promise<UserTokens & { refreshToken: string }>;
  /** 用剛拿到的存取權杖打一次最近播放（確認允許名單與 scope） */
  probe: (accessToken: string) => Promise<unknown>;
  save: (userId: string, refreshToken: string, scope: string) => Promise<void>;
  warn: (title: string, detail: string) => void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handleSpotifyCallback(input: CallbackInput, deps: CallbackDeps): Promise<ConnectResult> {
  if (!sameState(input.state, input.cookieState) || !input.userId) return "invalid_state";
  if (input.error) return input.error === "access_denied" ? "denied" : "error";
  if (!input.code) return "error";
  const userId = input.userId;
  try {
    const tokens = await deps.exchange(input.code);
    await deps.probe(tokens.accessToken);
    await deps.save(userId, tokens.refreshToken, tokens.scope);
    return "connected";
  } catch (error) {
    if (isNotAllowlisted(error)) return "not_allowed";
    if (error instanceof TokenKeyError) {
      deps.warn("Spotify 連結停用：加密金鑰沒設好（SPOTIFY_TOKEN_KEY）", message(error));
      return "unavailable";
    }
    deps.warn("Spotify 連結失敗", `user=${userId}：${message(error)}`);
    return "error";
  }
}
