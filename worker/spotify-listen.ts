/**
 * Spotify 收聽紀錄提醒（Q-64 C1）：每 N 分鐘（預設 20，WORKER_SPOTIFY_LISTEN=on 才跑）替連結了 Spotify 的人
 * 拉最近 50 首 → 判斷聽完哪幾張專輯（src/lib/spotify/listening.ts）→ 建「要不要記一筆《專輯》？」通知（同張同天一次）→ 有訂閱就推播。
 * 每人流程：解密 refresh token → 換存取權杖（Spotify 換了新 refresh token 就加密存回）→ 讀最近播放 → 判斷 → 寫 last_polled_at。
 * - 使用者在 Spotify 撤銷（invalid_grant）或被移出允許名單（403）→ 狀態改 revoked，設定頁請他重新連結（info 警報）。
 * - 429（配額以開發者帳號計）→ 推警報、這輪其餘的人不拉（冷卻）；其他失敗記 last_error＋warn，不影響下一位。
 * - 收聽紀錄不落地：只在記憶體判斷，DB 只存提醒本身。
 * 降級不可靜默：任何失敗都走 notify()。
 */

import { SpotifyApiError } from "../src/lib/spotify/api.ts";
import { finishedAlbums, listenPrompt, type ListenPrompt, type ListenRule } from "../src/lib/spotify/listening.ts";
import { isNotAllowlisted, isRevokedGrant, type RecentPlay, type UserTokens } from "../src/lib/spotify/user-api.ts";
import type { Notify } from "./notify.ts";
import { pushToAll, type PushOutcome, type PushPayload, type StoredPushSubscription } from "./reminders.ts";

export interface ListenConnection {
  userId: string;
  refreshTokenEnc: string;
}

export interface ListenDeps {
  /** active、上次拉取早於 now - interval 的連結 */
  listDue(): Promise<ListenConnection[]>;
  decrypt(connection: ListenConnection): string;
  refresh(refreshToken: string): Promise<UserTokens>;
  /** Spotify 換了新的 refresh token：加密存回 */
  saveRotated(userId: string, refreshToken: string): Promise<void>;
  fetchPlays(accessToken: string): Promise<RecentPlay[]>;
  /** 寫 last_polled_at；error 為 null＝成功（清掉 last_error） */
  markPolled(userId: string, error: string | null): Promise<void>;
  markRevoked(userId: string, reason: string): Promise<void>;
  /** 回 true＝這次新建（同 user_id＋dedupe_key 已有就 false） */
  createPrompt(userId: string, prompt: ListenPrompt): Promise<boolean>;
  listSubscriptions(): Promise<StoredPushSubscription[]>;
  sendPush: ((subscription: StoredPushSubscription, payload: PushPayload) => Promise<PushOutcome>) | null;
  removeSubscription(endpoint: string): Promise<void>;
  notify: Notify;
  now(): Date;
  rule?: ListenRule;
}

export interface ListenRunResult {
  polled: number;
  prompted: number;
  pushed: number;
  revoked: number;
  failed: number;
  /** 429：這輪提早停 */
  rateLimited: boolean;
}

const EMPTY: ListenRunResult = { polled: 0, prompted: 0, pushed: 0, revoked: 0, failed: 0, rateLimited: false };

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type PersonOutcome =
  | { kind: "ok"; prompted: number; pushed: number }
  | { kind: "revoked" }
  | { kind: "failed" }
  | { kind: "rate_limited" };

async function accessTokenFor(connection: ListenConnection, deps: ListenDeps): Promise<string> {
  const tokens = await deps.refresh(deps.decrypt(connection));
  if (tokens.refreshToken) await deps.saveRotated(connection.userId, tokens.refreshToken);
  return tokens.accessToken;
}

async function promptAlbums(
  connection: ListenConnection,
  plays: readonly RecentPlay[],
  subscriptions: readonly StoredPushSubscription[],
  deps: ListenDeps,
): Promise<{ prompted: number; pushed: number }> {
  const now = deps.now();
  let prompted = 0;
  let pushed = 0;
  for (const album of finishedAlbums(plays, now, deps.rule)) {
    const prompt = listenPrompt(album, now);
    if (!(await deps.createPrompt(connection.userId, prompt))) continue;
    prompted += 1;
    const own = subscriptions.filter((subscription) => subscription.userId === connection.userId);
    const sent = await pushToAll(deps, own, { title: prompt.title, body: prompt.body, url: prompt.url, tag: `listen-${album.albumId}` });
    pushed += sent.pushed;
  }
  return { prompted, pushed };
}

async function pollOne(connection: ListenConnection, subscriptions: readonly StoredPushSubscription[], deps: ListenDeps): Promise<PersonOutcome> {
  try {
    const accessToken = await accessTokenFor(connection, deps);
    const plays = await deps.fetchPlays(accessToken);
    const { prompted, pushed } = await promptAlbums(connection, plays, subscriptions, deps);
    await deps.markPolled(connection.userId, null);
    return { kind: "ok", prompted, pushed };
  } catch (error) {
    if (isRevokedGrant(error) || isNotAllowlisted(error)) {
      const reason = isRevokedGrant(error) ? "使用者在 Spotify 撤銷授權（invalid_grant）" : "不在開發模式允許名單（403）";
      await deps.markRevoked(connection.userId, reason).catch((markError) => deps.notify("warn", "Spotify 連結標記撤銷失敗", message(markError)));
      await deps.notify("info", "Spotify 收聽紀錄：連結失效，已請使用者重新連結", `user=${connection.userId} ${reason}`);
      return { kind: "revoked" };
    }
    if (error instanceof SpotifyApiError && error.rateLimited) {
      if (!error.cooling) await deps.notify("warn", "Spotify 收聽紀錄：429 配額用完，這輪先停", `user=${connection.userId}：${message(error)}`);
      return { kind: "rate_limited" };
    }
    await deps.markPolled(connection.userId, message(error).slice(0, 500)).catch(() => undefined);
    await deps.notify("warn", "Spotify 收聽紀錄拉取失敗", `user=${connection.userId}：${message(error)}`);
    return { kind: "failed" };
  }
}

async function loadSubscriptions(deps: ListenDeps): Promise<StoredPushSubscription[]> {
  try {
    return await deps.listSubscriptions();
  } catch (error) {
    await deps.notify("warn", "讀取推播訂閱失敗，收聽提醒本輪只建 App 內通知", message(error));
    return [];
  }
}

export async function processListenPrompts(deps: ListenDeps): Promise<ListenRunResult> {
  let due: ListenConnection[];
  try {
    due = await deps.listDue();
  } catch (error) {
    await deps.notify("warn", "讀取 Spotify 連結失敗（migration 041 套了嗎？）", message(error));
    return EMPTY;
  }
  if (due.length === 0) return EMPTY;
  const subscriptions = await loadSubscriptions(deps);
  let result = EMPTY;
  for (const connection of due) {
    const outcome = await pollOne(connection, subscriptions, deps);
    if (outcome.kind === "rate_limited") return { ...result, rateLimited: true };
    result = {
      ...result,
      polled: result.polled + 1,
      prompted: result.prompted + (outcome.kind === "ok" ? outcome.prompted : 0),
      pushed: result.pushed + (outcome.kind === "ok" ? outcome.pushed : 0),
      revoked: result.revoked + (outcome.kind === "revoked" ? 1 : 0),
      failed: result.failed + (outcome.kind === "failed" ? 1 : 0),
    };
  }
  return result;
}
