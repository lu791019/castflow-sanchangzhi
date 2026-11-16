/**
 * Spotify 收聽紀錄提醒的接線（worker 主迴圈每輪呼叫，自己依間隔決定要不要跑）：
 * config → Spotify 用戶端（正式網址，worker 不吃 E2E 覆寫）、DB、推播、警報 → processListenPrompts。
 */

import { createSpotifyAppState, SPOTIFY_ACCOUNTS_BASE, SPOTIFY_API_BASE, type SpotifyAppDeps } from "../src/lib/spotify/api.ts";
import { decryptToken } from "../src/lib/spotify/token-crypto.ts";
import { fetchRecentlyPlayed, refreshUserToken } from "../src/lib/spotify/user-api.ts";
import type { WorkerConfig } from "./config.ts";
import { deletePushSubscription, listPushSubscriptions, type WorkerDb } from "./db.ts";
import type { Notify } from "./notify.ts";
import type { ReminderDeps } from "./reminders.ts";
import {
  insertListenPrompt,
  listDueConnections,
  markConnectionPolled,
  markConnectionRevoked,
  saveRotatedRefreshToken,
} from "./spotify-db.ts";
import { processListenPrompts, type ListenDeps } from "./spotify-listen.ts";

export interface ListenRunnerOptions {
  config: WorkerConfig["spotifyListen"];
  db: WorkerDb;
  notify: Notify;
  sendPush: ReminderDeps["sendPush"];
  log: (line: string) => void;
  now?: () => number;
}

/** 回 null＝停用（沒開，或開了但缺金鑰：啟動時已警報）；否則回每輪呼叫的函式（間隔內直接返回） */
export function createListenRunner(options: ListenRunnerOptions): (() => Promise<void>) | null {
  const { config, db, notify, sendPush, log } = options;
  if (!config.enabled || !config.credentials || !config.tokenKey) return null;
  const now = options.now ?? Date.now;
  const tokenKey = config.tokenKey;
  const app: SpotifyAppDeps = {
    fetch,
    credentials: config.credentials,
    urls: { apiBase: SPOTIFY_API_BASE, accountsBase: SPOTIFY_ACCOUNTS_BASE },
    state: createSpotifyAppState(),
  };
  const deps: ListenDeps = {
    listDue: () => listDueConnections(db, config.intervalMs),
    decrypt: (connection) => decryptToken(connection.refreshTokenEnc, connection.userId, tokenKey),
    refresh: (refreshToken) => refreshUserToken(refreshToken, app),
    saveRotated: (userId, refreshToken) => saveRotatedRefreshToken(db, userId, refreshToken, tokenKey),
    fetchPlays: (accessToken) => fetchRecentlyPlayed(accessToken, app),
    markPolled: (userId, error) => markConnectionPolled(db, userId, error),
    markRevoked: (userId, reason) => markConnectionRevoked(db, userId, reason),
    createPrompt: (userId, prompt) => insertListenPrompt(db, userId, prompt),
    listSubscriptions: () => listPushSubscriptions(db),
    sendPush,
    removeSubscription: (endpoint) => deletePushSubscription(db, endpoint),
    notify,
    now: () => new Date(now()),
  };
  let lastRunAt = 0;
  return async () => {
    if (now() - lastRunAt < config.intervalMs) return;
    lastRunAt = now();
    const result = await processListenPrompts(deps);
    if (result.polled > 0 || result.rateLimited) {
      log(
        `Spotify 收聽紀錄：拉 ${result.polled} 人、新提醒 ${result.prompted}、推播 ${result.pushed}、撤銷 ${result.revoked}、失敗 ${result.failed}${result.rateLimited ? "（429，這輪提早停）" : ""}`,
      );
    }
  };
}
