/** Web Push 發送（web-push + VAPID）；把例外轉成 PushOutcome，交給 reminders 決定警報 */

import webpush from "web-push";
import type { PushOutcome, PushPayload, StoredPushSubscription } from "./reminders.ts";

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** 推播在裝置上的保留時間（秒）：一天內沒上線就算了 */
const PUSH_TTL_SECONDS = 24 * 60 * 60;
const GONE_STATUS = new Set([404, 410]);

export type SendNotificationFn = typeof webpush.sendNotification;

export function createPushSender(
  vapid: VapidConfig,
  send: SendNotificationFn = webpush.sendNotification.bind(webpush),
): (subscription: StoredPushSubscription, payload: PushPayload) => Promise<PushOutcome> {
  return async (subscription, payload) => {
    try {
      await send(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        JSON.stringify(payload),
        {
          TTL: PUSH_TTL_SECONDS,
          urgency: "normal",
          vapidDetails: {
            subject: vapid.subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
        },
      );
      return { ok: true };
    } catch (error) {
      const statusCode = (error as { statusCode?: unknown }).statusCode;
      const status = typeof statusCode === "number" ? statusCode : null;
      const body = (error as { body?: unknown }).body;
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        gone: status !== null && GONE_STATUS.has(status),
        message: `${status ?? "network"} ${detail}${typeof body === "string" && body ? ` — ${body.slice(0, 200)}` : ""}`,
      };
    }
  };
}
