/**
 * 「想說說嗎？」提醒派送：每輪 worker 呼叫一次。
 * 到期紀錄 → 建 App 內通知（必有）→ 有訂閱就 Web Push → 寫 reminded_at。
 * 冪等：notifications(journal_entry_id, kind) unique，重跑不會重複建；
 * 只有「這輪新建」的通知才推播，避免上輪寫 reminded_at 失敗後重推。
 * 同一位使用者這輪有多筆：App 內通知照樣每筆一則，推播合併成一則，連到最晚看的那筆。
 * 散場當下提醒（settle_prompt，migration 032）：不寫 reminded_at（去重靠通知 unique），推播獨立一則不與其他合併；
 * push=false（深夜改隔天早上）只進收件匣。
 * 降級不可靜默：任何失敗都走 notify()；推播未設定（VAPID）每個 process 只警報一次。
 */

import type { Notify } from "./notify.ts";

export interface DueReminder {
  journalEntryId: string;
  remindAt: string;
  title: string;
  body: string;
  url: string;
  /** 看／聽的時間；合併推播時挑最晚的那筆（舊版 API 沒帶時退回 remindAt） */
  experiencedAt?: string;
  /** 紀錄擁有者；推播只發給同一使用者的訂閱 */
  userId?: string;
  /** 省略＝say_reminder；plan_reminder＝排行程當天提醒（migration 026）；settle_prompt＝散場當下（032） */
  kind?: "say_reminder" | "plan_reminder" | "settle_prompt";
  /** settle_prompt：false＝只進收件匣不推播；省略＝照常推 */
  push?: boolean;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** App 有畫面開著時 service worker 不跳通知（「整理好了」用；提醒照跳） */
  quietIfOpen?: boolean;
}

export type PushOutcome = { ok: true } | { ok: false; gone: boolean; message: string };

export interface ReminderDeps {
  fetchDue(): Promise<DueReminder[]>;
  /** 回傳 true = 這輪新建；false = 已存在（之前建過） */
  createNotification(reminder: DueReminder): Promise<boolean>;
  listSubscriptions(): Promise<StoredPushSubscription[]>;
  /** null = VAPID 未設定，Web Push 停用 */
  sendPush: ((subscription: StoredPushSubscription, payload: PushPayload) => Promise<PushOutcome>) | null;
  removeSubscription(endpoint: string): Promise<void>;
  markReminded(journalEntryId: string): Promise<void>;
  notify: Notify;
}

export interface ReminderRunResult {
  due: number;
  notified: number;
  pushed: number;
  pushFailed: number;
  marked: number;
}

const EMPTY_RESULT: ReminderRunResult = { due: 0, notified: 0, pushed: 0, pushFailed: 0, marked: 0 };

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface PushTally {
  pushed: number;
  failed: number;
}

export async function pushToAll(
  deps: Pick<ReminderDeps, "sendPush" | "removeSubscription" | "notify">,
  subscriptions: readonly StoredPushSubscription[],
  payload: PushPayload,
): Promise<PushTally> {
  if (!deps.sendPush || subscriptions.length === 0) return { pushed: 0, failed: 0 };
  let pushed = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    const outcome = await deps.sendPush(subscription, payload);
    if (outcome.ok) {
      pushed += 1;
      continue;
    }
    failed += 1;
    if (outcome.gone) {
      // 410/404：使用者已取消或瀏覽器換訂閱 → 清掉，不算故障
      await deps.removeSubscription(subscription.endpoint).catch((error) =>
        deps.notify("warn", "清除失效推播訂閱失敗", message(error)),
      );
      await deps.notify("info", "推播訂閱已失效並移除", subscription.endpoint.slice(0, 80));
    } else {
      await deps.notify("warn", "Web Push 發送失敗（App 內通知已建立）", outcome.message);
    }
  }
  return { pushed, failed };
}

/** 推播未設定的警報每個 process 只發一次（正式站目前沒有 VAPID，避免每輪洗版） */
let pushUnconfiguredWarned = false;

export function resetPushUnconfiguredWarning(): void {
  pushUnconfiguredWarned = false;
}

async function warnPushUnconfiguredOnce(notify: Notify): Promise<void> {
  if (pushUnconfiguredWarned) return;
  pushUnconfiguredWarned = true;
  await notify("warn", "推播未設定（VAPID 金鑰），只寫收件匣通知");
}

function isSettle(reminder: DueReminder): boolean {
  return reminder.kind === "settle_prompt";
}

function seenAt(reminder: DueReminder): string {
  return reminder.experiencedAt ?? reminder.remindAt;
}

/** 一位使用者這輪的提醒合成一則推播：標題與連結用最晚看的那筆，內文補其餘筆數 */
export function mergedPushPayload(reminders: readonly DueReminder[], tagPrefix = "say-reminder"): PushPayload {
  const primary = reminders.reduce((latest, reminder) => (seenAt(reminder) > seenAt(latest) ? reminder : latest));
  const others = reminders.length - 1;
  return {
    title: primary.title,
    body: others > 0 ? `${primary.body}（另有 ${others} 筆在收件匣）` : primary.body,
    url: primary.url,
    tag: `${tagPrefix}-${primary.journalEntryId}`,
  };
}

async function pushToOwners(
  deps: ReminderDeps,
  subscriptions: readonly StoredPushSubscription[],
  created: readonly DueReminder[],
  tagPrefix = "say-reminder",
): Promise<PushTally> {
  const byUser = new Map<string, DueReminder[]>();
  for (const reminder of created) {
    if (!reminder.userId) {
      await deps.notify("warn", "提醒缺少使用者，未推播（App 內通知已建立）", reminder.journalEntryId);
      continue;
    }
    byUser.set(reminder.userId, [...(byUser.get(reminder.userId) ?? []), reminder]);
  }
  let tally: PushTally = { pushed: 0, failed: 0 };
  for (const [userId, reminders] of byUser) {
    const own = subscriptions.filter((subscription) => subscription.userId === userId);
    const sent = await pushToAll(deps, own, mergedPushPayload(reminders, tagPrefix));
    tally = { pushed: tally.pushed + sent.pushed, failed: tally.failed + sent.failed };
  }
  return tally;
}

async function loadSubscriptions(deps: ReminderDeps): Promise<StoredPushSubscription[]> {
  try {
    const subscriptions = await deps.listSubscriptions();
    if (!deps.sendPush) await warnPushUnconfiguredOnce(deps.notify);
    return subscriptions;
  } catch (error) {
    await deps.notify("warn", "讀取推播訂閱失敗，本輪只建 App 內通知", message(error));
    return [];
  }
}

export async function processReminders(deps: ReminderDeps): Promise<ReminderRunResult> {
  let due: DueReminder[];
  try {
    due = await deps.fetchDue();
  } catch (error) {
    await deps.notify("warn", "讀取到期提醒失敗（app API 無法呼叫？）", message(error));
    return EMPTY_RESULT;
  }
  if (due.length === 0) return EMPTY_RESULT;

  const subscriptions = await loadSubscriptions(deps);
  let result: ReminderRunResult = { ...EMPTY_RESULT, due: due.length };
  const created: DueReminder[] = [];

  for (const reminder of due) {
    let isNew: boolean;
    try {
      isNew = await deps.createNotification(reminder);
    } catch (error) {
      await deps.notify("error", "建立提醒通知失敗", `${reminder.journalEntryId}：${message(error)}`);
      continue;
    }
    if (isNew) created.push(reminder);
    result = { ...result, notified: result.notified + (isNew ? 1 : 0) };
    // 散場提醒不碰 reminded_at：那是當天提醒與「想說說嗎」的去重欄位
    if (isSettle(reminder)) continue;

    try {
      await deps.markReminded(reminder.journalEntryId);
      result = { ...result, marked: result.marked + 1 };
    } catch (error) {
      await deps.notify("error", "寫入 reminded_at 失敗", `${reminder.journalEntryId}：${message(error)}`);
    }
  }

  const regular = await pushToOwners(deps, subscriptions, created.filter((reminder) => !isSettle(reminder)));
  // 散場提醒一則一推（不與其他合併）；push=false 的只進收件匣
  const settle = created.filter((reminder) => isSettle(reminder) && reminder.push !== false);
  let tally = regular;
  for (const reminder of settle) {
    const sent = await pushToOwners(deps, subscriptions, [reminder], "settle-prompt");
    tally = { pushed: tally.pushed + sent.pushed, failed: tally.failed + sent.failed };
  }
  return { ...result, pushed: tally.pushed, pushFailed: tally.failed };
}
