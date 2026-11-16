/**
 * 「整理好了」推播：說一段的錄音轉成文字後推一則，點開進校樣。
 * 只推播不進收件匣；App 開著時 service worker 不跳（payload.quietIfOpen）。
 * 冪等：先搶寫 ready_notified_at（只有這輪搶到的才推），重跑不會重推。
 * 文案依推播稿語氣規則：時間＋作品當標題，不用驚嘆號。
 */

import type { Notify } from "./notify.ts";
import { pushToAll, type PushPayload, type ReminderDeps, type StoredPushSubscription } from "./reminders.ts";

export interface ReadyEpisode {
  episodeId: string;
  userId: string;
  /** 作品名（Podcast 用節目名）；沒連作品為 null */
  workTitle: string | null;
}

export interface ReadyDeps {
  fetchReady(): Promise<ReadyEpisode[]>;
  /** 回傳 true = 這輪搶到（之前沒通知過） */
  claim(episodeId: string): Promise<boolean>;
  listSubscriptions(): Promise<StoredPushSubscription[]>;
  sendPush: ReminderDeps["sendPush"];
  removeSubscription(endpoint: string): Promise<void>;
  notify: Notify;
}

export interface ReadyRunResult {
  ready: number;
  pushed: number;
  pushFailed: number;
}

const EMPTY: ReadyRunResult = { ready: 0, pushed: 0, pushFailed: 0 };

export function readyPushPayload(episode: ReadyEpisode): PushPayload {
  return {
    title: episode.workTitle ? `剛剛說的《${episode.workTitle}》` : "剛剛說的那段",
    body: "整理好了，校樣在等你看。",
    url: `/proof/${episode.episodeId}`,
    tag: `say-ready-${episode.episodeId}`,
    quietIfOpen: true,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function processReadyNotifications(deps: ReadyDeps): Promise<ReadyRunResult> {
  let ready: ReadyEpisode[];
  try {
    ready = await deps.fetchReady();
  } catch (error) {
    await deps.notify("warn", "讀取「整理好了」待推清單失敗", message(error));
    return EMPTY;
  }
  if (ready.length === 0) return EMPTY;

  let subscriptions: StoredPushSubscription[] = [];
  try {
    subscriptions = await deps.listSubscriptions();
  } catch (error) {
    await deps.notify("warn", "讀取推播訂閱失敗，本輪「整理好了」不推", message(error));
    return { ...EMPTY, ready: ready.length };
  }

  let result: ReadyRunResult = { ...EMPTY, ready: ready.length };
  for (const episode of ready) {
    let claimed: boolean;
    try {
      claimed = await deps.claim(episode.episodeId);
    } catch (error) {
      await deps.notify("error", "寫入 ready_notified_at 失敗", `${episode.episodeId}：${message(error)}`);
      continue;
    }
    if (!claimed) continue;
    const own = subscriptions.filter((subscription) => subscription.userId === episode.userId);
    const tally = await pushToAll(deps, own, readyPushPayload(episode));
    result = { ...result, pushed: result.pushed + tally.pushed, pushFailed: result.pushFailed + tally.failed };
  }
  return result;
}
