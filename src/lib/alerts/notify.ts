/**
 * Web 端（server only）的 notify()：沿用 worker 的同一套警報器，
 * 寫 console + alerts.log，warn/error 依環境變數外推（webhook / LINE）。
 */

import path from "node:path";
import { createNotifier, type Notify } from "../../../worker/notify";

let notifier: Notify | null = null;

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getServerNotify(): Notify {
  if (!notifier) {
    notifier = createNotifier({
      alertLogPath: readEnv("ALERT_LOG_PATH") ?? path.join(process.cwd(), "worker", "alerts.log"),
      webhookUrl: readEnv("ALERT_WEBHOOK_URL"),
      lineToken: readEnv("LINE_CHANNEL_ACCESS_TOKEN"),
      lineTo: readEnv("LINE_TO"),
    });
  }
  return notifier;
}
