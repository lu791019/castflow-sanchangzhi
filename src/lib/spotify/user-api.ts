/**
 * Spotify 使用者授權（Q-64 C1）：authorization code（伺服器端用 secret 交換）、refresh token 換存取權杖、最近播放。
 * scope 只要 user-read-recently-played；開發模式只有允許名單內的人拿得到資料，其他人呼叫 API 回 403。
 * web（OAuth 路由）與本機 worker（定期拉）共用：只用相對路徑 import；不印、不 log 任何權杖。
 */

import {
  assertNotCooling,
  basicAuth,
  readJson,
  SpotifyApiError,
  spotifyError,
  spotifySend,
  startCooldown,
  type SpotifyAppDeps,
} from "./api.ts";

export const SPOTIFY_LISTEN_SCOPE = "user-read-recently-played";
/** 最近播放一次最多 50 首（Spotify 上限） */
export const RECENTLY_PLAYED_LIMIT = 50;

type Raw = Record<string, unknown>;
type UserDeps = Pick<SpotifyAppDeps, "fetch" | "credentials" | "urls" | "state" | "now">;

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string;
  accountsBase: string;
}

export function authorizeUrl({ clientId, redirectUri, state, accountsBase }: AuthorizeParams): string {
  const url = new URL(`${accountsBase}/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SPOTIFY_LISTEN_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export interface UserTokens {
  accessToken: string;
  /** authorization code 一定有；refresh 時 Spotify 可能換一把新的（沒換就 null，沿用舊的） */
  refreshToken: string | null;
  scope: string;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function postToken(body: URLSearchParams, deps: UserDeps, what: string): Promise<UserTokens> {
  assertNotCooling(deps);
  const response = await spotifySend(
    deps,
    `${deps.urls.accountsBase}/api/token`,
    {
      method: "POST",
      headers: { Authorization: basicAuth(deps.credentials), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
    what,
  );
  if (!response.ok) {
    const error = await spotifyError(response, what);
    startCooldown(deps, error);
    throw error;
  }
  const raw = await readJson(response);
  const accessToken = text(raw.access_token);
  if (!accessToken) throw new SpotifyApiError(`Spotify ${what}失敗：回應沒有 access_token`, { status: response.status });
  return { accessToken, refreshToken: text(raw.refresh_token), scope: text(raw.scope) ?? "" };
}

/** OAuth callback：code 換權杖（redirect_uri 要跟授權時一字不差） */
export async function exchangeCode(code: string, redirectUri: string, deps: UserDeps): Promise<UserTokens & { refreshToken: string }> {
  const tokens = await postToken(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }), deps, "交換授權碼");
  if (!tokens.refreshToken) throw new SpotifyApiError("Spotify 交換授權碼失敗：回應沒有 refresh_token", { status: 200 });
  return { ...tokens, refreshToken: tokens.refreshToken };
}

/** refresh token → 存取權杖；使用者在 Spotify 撤銷授權時回 400 invalid_grant（isRevokedGrant） */
export async function refreshUserToken(refreshToken: string, deps: UserDeps): Promise<UserTokens> {
  return postToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }), deps, "更新權杖");
}

export function isRevokedGrant(error: unknown): boolean {
  return error instanceof SpotifyApiError && error.status === 400 && error.code === "invalid_grant";
}

/** 不在開發模式允許名單：API 回 403（User not registered in the Developer Dashboard） */
export function isNotAllowlisted(error: unknown): boolean {
  return error instanceof SpotifyApiError && error.status === 403;
}

export interface RecentPlay {
  playedAt: string;
  trackId: string;
  album: {
    id: string;
    name: string;
    albumType: string;
    totalTracks: number | null;
    artists: string[];
    imageUrl: string | null;
  };
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((item) => (item && typeof item === "object" && text((item as Raw).name) ? [text((item as Raw).name) as string] : [])) : [];
}

function httpsImage(album: Raw): string | null {
  const images = Array.isArray(album.images) ? (album.images as Raw[]) : [];
  return images.map((image) => text(image?.url)).find((url): url is string => Boolean(url?.startsWith("https://"))) ?? null;
}

/** 最近播放的一筆 → RecentPlay；缺 album id、track id 或時間就丟掉（Podcast 單集不會出現在這支 API） */
export function toRecentPlay(raw: Raw): RecentPlay | null {
  const track = raw.track && typeof raw.track === "object" ? (raw.track as Raw) : null;
  const album = track?.album && typeof track.album === "object" ? (track.album as Raw) : null;
  const playedAt = text(raw.played_at);
  const trackId = text(track?.id);
  const albumId = text(album?.id);
  const albumName = text(album?.name);
  if (!track || !album || !playedAt || Number.isNaN(Date.parse(playedAt)) || !trackId || !albumId || !albumName) return null;
  return {
    playedAt,
    trackId,
    album: {
      id: albumId,
      name: albumName,
      albumType: text(album.album_type) ?? "album",
      totalTracks: typeof album.total_tracks === "number" ? album.total_tracks : null,
      artists: names(album.artists),
      imageUrl: httpsImage(album),
    },
  };
}

/** GET /me/player/recently-played?limit=50（新到舊）；403＝不在允許名單 */
export async function fetchRecentlyPlayed(accessToken: string, deps: UserDeps): Promise<RecentPlay[]> {
  assertNotCooling(deps);
  const url = new URL(`${deps.urls.apiBase}/me/player/recently-played`);
  url.searchParams.set("limit", String(RECENTLY_PLAYED_LIMIT));
  const response = await spotifySend(deps, url.toString(), { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }, "讀最近播放");
  if (!response.ok) {
    const error = await spotifyError(response, "讀最近播放");
    startCooldown(deps, error);
    throw error;
  }
  const body = await readJson(response);
  const items = Array.isArray(body.items) ? (body.items as unknown[]) : [];
  return items.flatMap((item) => (item && typeof item === "object" ? (toRecentPlay(item as Raw) ?? []) : []));
}
