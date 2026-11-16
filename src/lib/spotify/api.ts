/**
 * Spotify Web API 最小用戶端（Q-64）：client credentials 權杖（快取到過期前）、搜尋專輯／節目、429 冷卻。
 * 開發模式限制（Dex 10/16）：搜尋一次最多 10 筆、配額以開發者帳號計，超過回 429（body reason QUOTA_EXCEEDED）。
 * 429 之後在 Retry-After（沒給就 10 分鐘）內不再打，直接丟 SpotifyApiError，呼叫端略過並推警報。
 * 依賴注入（fetch、時鐘、網址），單元測試不真打 Spotify；本機 worker 也會用：只用相對路徑 import。
 */

import { externalOverridesAllowed } from "../e2e-overrides.ts";
import type { SpotifyAlbumCandidate, SpotifyShowCandidate } from "./match.ts";

export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
export const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";
export const SPOTIFY_SEARCH_LIMIT = 10;
export const SPOTIFY_MARKET = "TW";
const TIMEOUT_MS = 8_000;
/** 權杖過期前這麼久就換新的，避免剛好在請求途中過期 */
const TOKEN_EARLY_MS = 60_000;
const DEFAULT_COOLDOWN_MS = 10 * 60_000;

type Env = Readonly<Record<string, string | undefined>>;
type Raw = Record<string, unknown>;

export interface SpotifyErrorInfo {
  status: number | null;
  /** 429（配額用完或限流）：呼叫端要推警報 */
  rateLimited?: boolean;
  /** body reason QUOTA_EXCEEDED */
  quotaExceeded?: boolean;
  retryAfterMs?: number | null;
  /** 冷卻中直接略過、沒有真的打（警報在進入冷卻那次推過了，不重推） */
  cooling?: boolean;
  /** 帳號端點的錯誤碼（body.error 是字串時，例：invalid_grant） */
  code?: string | null;
}

export class SpotifyApiError extends Error {
  readonly status: number | null;
  readonly rateLimited: boolean;
  readonly quotaExceeded: boolean;
  readonly retryAfterMs: number | null;
  readonly cooling: boolean;
  readonly code: string | null;

  constructor(message: string, info: SpotifyErrorInfo) {
    super(message);
    this.name = "SpotifyApiError";
    this.status = info.status;
    this.rateLimited = info.rateLimited ?? false;
    this.quotaExceeded = info.quotaExceeded ?? false;
    this.retryAfterMs = info.retryAfterMs ?? null;
    this.cooling = info.cooling ?? false;
    this.code = info.code ?? null;
  }
}

export interface SpotifyUrls {
  apiBase: string;
  accountsBase: string;
}

/** env SPOTIFY_API_BASE／SPOTIFY_ACCOUNTS_BASE：只給本機 E2E 指到假路由（Cloud Run 一律不吃） */
export function spotifyUrlsFromEnv(env: Env = process.env): SpotifyUrls {
  const allowed = externalOverridesAllowed(env);
  const api = allowed ? env.SPOTIFY_API_BASE?.trim() : undefined;
  const accounts = allowed ? env.SPOTIFY_ACCOUNTS_BASE?.trim() : undefined;
  return { apiBase: api || SPOTIFY_API_BASE, accountsBase: accounts || SPOTIFY_ACCOUNTS_BASE };
}

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
}

export function spotifyCredentialsFromEnv(env: Env = process.env): SpotifyCredentials | null {
  const clientId = env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = env.SPOTIFY_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** 同一個 process 共用：權杖快取＋429 冷卻 */
export interface SpotifyAppState {
  token: { value: string; expiresAt: number } | null;
  cooldownUntil: number;
}

export function createSpotifyAppState(): SpotifyAppState {
  return { token: null, cooldownUntil: 0 };
}

export interface SpotifyAppDeps {
  fetch: typeof fetch;
  credentials: SpotifyCredentials;
  urls: SpotifyUrls;
  state: SpotifyAppState;
  now?: () => number;
}

export function basicAuth({ clientId, clientSecret }: SpotifyCredentials): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function retryAfterMs(response: Response): number | null {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

export async function readJson(response: Response): Promise<Raw> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? (body as Raw) : {};
  } catch {
    return {};
  }
}

/** 429 body：{ error: { status, message, reason } } 或頂層 reason；兩種都認 */
export function isQuotaBody(body: Raw): boolean {
  const nested = body.error && typeof body.error === "object" ? (body.error as Raw).reason : undefined;
  return body.reason === "QUOTA_EXCEEDED" || nested === "QUOTA_EXCEEDED";
}

/** 非 2xx → SpotifyApiError；訊息不帶權杖或任何 header */
export async function spotifyError(response: Response, what: string): Promise<SpotifyApiError> {
  const body = await readJson(response);
  const rateLimited = response.status === 429;
  const quotaExceeded = rateLimited && isQuotaBody(body);
  const code = typeof body.error === "string" ? body.error : null;
  const suffix = quotaExceeded ? "（QUOTA_EXCEEDED）" : code ? `（${code}）` : "";
  return new SpotifyApiError(`Spotify ${what} 失敗：HTTP ${response.status}${suffix}`, {
    status: response.status,
    rateLimited,
    quotaExceeded,
    retryAfterMs: retryAfterMs(response),
    code,
  });
}

export async function spotifySend(deps: Pick<SpotifyAppDeps, "fetch">, url: string, init: RequestInit, what: string): Promise<Response> {
  try {
    return await deps.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (error) {
    throw new SpotifyApiError(`Spotify ${what} 連線失敗：${error instanceof Error ? error.message : String(error)}`, { status: null });
  }
}

export function assertNotCooling(deps: Pick<SpotifyAppDeps, "state" | "now">): void {
  const now = (deps.now ?? Date.now)();
  if (deps.state.cooldownUntil > now) {
    const left = Math.ceil((deps.state.cooldownUntil - now) / 1000);
    throw new SpotifyApiError(`Spotify 配額冷卻中（還有 ${left} 秒），這次略過`, {
      status: 429,
      rateLimited: true,
      retryAfterMs: deps.state.cooldownUntil - now,
      cooling: true,
    });
  }
}

export function startCooldown(deps: Pick<SpotifyAppDeps, "state" | "now">, error: SpotifyApiError): void {
  if (!error.rateLimited) return;
  deps.state.cooldownUntil = (deps.now ?? Date.now)() + (error.retryAfterMs ?? DEFAULT_COOLDOWN_MS);
}

/** client credentials 權杖：快取到過期前 60 秒 */
export async function getAppToken(deps: SpotifyAppDeps): Promise<string> {
  assertNotCooling(deps);
  const now = (deps.now ?? Date.now)();
  const cached = deps.state.token;
  if (cached && cached.expiresAt - TOKEN_EARLY_MS > now) return cached.value;
  const response = await spotifySend(
    deps,
    `${deps.urls.accountsBase}/api/token`,
    {
      method: "POST",
      headers: { Authorization: basicAuth(deps.credentials), "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    },
    "取權杖",
  );
  if (!response.ok) {
    const error = await spotifyError(response, "取權杖");
    startCooldown(deps, error);
    throw error;
  }
  const body = await readJson(response);
  const value = typeof body.access_token === "string" ? body.access_token : "";
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 0;
  if (!value || expiresIn <= 0) throw new SpotifyApiError("Spotify 取權杖失敗：回應沒有 access_token", { status: response.status });
  deps.state.token = { value, expiresAt: now + expiresIn * 1000 };
  return value;
}

async function search(deps: SpotifyAppDeps, type: "album" | "show", query: string, retried = false): Promise<Raw[]> {
  assertNotCooling(deps);
  const token = await getAppToken(deps);
  const url = new URL(`${deps.urls.apiBase}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("market", SPOTIFY_MARKET);
  url.searchParams.set("limit", String(SPOTIFY_SEARCH_LIMIT));
  const response = await spotifySend(deps, url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }, "搜尋");
  if (response.status === 401 && !retried) {
    // 權杖被提早撤銷：丟掉快取重拿一次
    deps.state.token = null;
    return search(deps, type, query, true);
  }
  if (!response.ok) {
    const error = await spotifyError(response, "搜尋");
    startCooldown(deps, error);
    throw error;
  }
  const body = await readJson(response);
  const container = body[`${type}s`];
  const items = container && typeof container === "object" ? (container as Raw).items : null;
  return Array.isArray(items) ? items.filter((item): item is Raw => Boolean(item) && typeof item === "object") : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function toAlbumCandidate(raw: Raw): SpotifyAlbumCandidate | null {
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;
  const artists = Array.isArray(raw.artists)
    ? raw.artists.flatMap((artist) => {
        const artistName = artist && typeof artist === "object" ? text((artist as Raw).name) : null;
        return artistName ? [artistName] : [];
      })
    : [];
  return {
    id,
    name,
    album_type: text(raw.album_type) ?? "album",
    total_tracks: typeof raw.total_tracks === "number" ? raw.total_tracks : null,
    artists,
  };
}

export function toShowCandidate(raw: Raw): SpotifyShowCandidate | null {
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;
  return { id, name, publisher: text(raw.publisher), description: text(raw.description) };
}

export async function searchSpotifyAlbums(query: string, deps: SpotifyAppDeps): Promise<SpotifyAlbumCandidate[]> {
  return (await search(deps, "album", query)).flatMap((raw) => toAlbumCandidate(raw) ?? []);
}

export async function searchSpotifyShows(query: string, deps: SpotifyAppDeps): Promise<SpotifyShowCandidate[]> {
  return (await search(deps, "show", query)).flatMap((raw) => toShowCandidate(raw) ?? []);
}

export interface SpotifyAlbumDetail extends SpotifyAlbumCandidate {
  imageUrl: string | null;
}

function firstImage(raw: Raw): string | null {
  const images = Array.isArray(raw.images) ? (raw.images as Raw[]) : [];
  return images.map((image) => text(image?.url)).find((url): url is string => Boolean(url && url.startsWith("https://"))) ?? null;
}

/** 單張專輯（記一筆預選：收聽提醒只帶專輯 id）；查無回 null */
export async function getSpotifyAlbum(id: string, deps: SpotifyAppDeps): Promise<SpotifyAlbumDetail | null> {
  assertNotCooling(deps);
  const token = await getAppToken(deps);
  const url = new URL(`${deps.urls.apiBase}/albums/${encodeURIComponent(id)}`);
  url.searchParams.set("market", SPOTIFY_MARKET);
  const response = await spotifySend(deps, url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }, "讀專輯");
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    const error = await spotifyError(response, "讀專輯");
    startCooldown(deps, error);
    throw error;
  }
  const raw = await readJson(response);
  const album = toAlbumCandidate(raw);
  return album ? { ...album, imageUrl: firstImage(raw) } : null;
}
