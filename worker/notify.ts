import { appendFile } from "node:fs/promises";

export type AlertLevel = "info" | "warn" | "error";

export interface Alert {
  at: string;
  level: AlertLevel;
  title: string;
  detail: string;
}

export interface NotifierOptions {
  alertLogPath: string;
  /** webhook：Discord／Slack 依網址送對應格式，其他送原始 JSON */
  webhookUrl?: string | null;
  /** LINE Messaging API push（token + to 齊備才啟用） */
  lineToken?: string | null;
  lineTo?: string | null;
  /** 同 level+title 的外部推播節流間隔，避免 60s 迴圈灌爆通知 */
  throttleMs?: number;
  fetchFn?: typeof fetch;
  appendFn?: (filePath: string, line: string) => Promise<void>;
  logFn?: (line: string) => void;
  now?: () => Date;
}

export type Notify = (
  level: AlertLevel,
  title: string,
  detail?: string,
) => Promise<Alert>;

const DEFAULT_THROTTLE_MS = 10 * 60_000;
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const PUSH_TIMEOUT_MS = 10_000;

/** Discord 吃 { content }、Slack 吃 { text }；其他 webhook 收原始 Alert JSON */
export function webhookBody(url: string, alert: Alert): unknown {
  const host = new URL(url).hostname;
  if (host === "discord.com" || host === "discordapp.com") return { content: formatLine(alert).slice(0, 2000) };
  if (host === "hooks.slack.com") return { text: formatLine(alert) };
  return alert;
}

function formatLine(alert: Alert): string {
  return `[${alert.at}] [${alert.level.toUpperCase()}] ${alert.title}${alert.detail ? ` — ${alert.detail}` : ""}`;
}

/**
 * 警報單一入口 notify()：console + alerts.log 永遠寫；
 * warn/error 另外外推（webhook / LINE，設定齊才送）。
 * 外推失敗絕不拋出，但必寫 log——降級不可靜默（Q-19）。
 */
export function createNotifier(options: NotifierOptions): Notify {
  const {
    alertLogPath,
    webhookUrl = null,
    lineToken = null,
    lineTo = null,
    throttleMs = DEFAULT_THROTTLE_MS,
    fetchFn = fetch,
    appendFn = (filePath, line) => appendFile(filePath, line),
    logFn = (line) => console.error(line),
    now = () => new Date(),
  } = options;

  const lastPushedAt = new Map<string, number>();
  const hasExternal = Boolean(webhookUrl) || Boolean(lineToken && lineTo);
  let warnedNoExternal = false;

  async function record(alert: Alert): Promise<void> {
    logFn(formatLine(alert));
    try {
      await appendFn(alertLogPath, `${JSON.stringify(alert)}\n`);
    } catch (error) {
      logFn(`[notify] 寫入警報檔失敗：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function post(url: string, body: unknown, headers: Record<string, string>): Promise<void> {
    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  async function pushExternal(alert: Alert): Promise<void> {
    const targets: Array<{ name: string; send: () => Promise<void> }> = [];
    if (webhookUrl) {
      targets.push({ name: "webhook", send: () => post(webhookUrl, webhookBody(webhookUrl, alert), {}) });
    }
    if (lineToken && lineTo) {
      targets.push({
        name: "LINE",
        send: () =>
          post(
            LINE_PUSH_URL,
            {
              to: lineTo,
              messages: [{ type: "text", text: formatLine(alert) }],
            },
            { Authorization: `Bearer ${lineToken}` },
          ),
      });
    }

    for (const target of targets) {
      try {
        await target.send();
      } catch (error) {
        await record({
          at: alert.at,
          level: "warn",
          title: `警報外推失敗（${target.name}）`,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return async function notify(level, title, detail = "") {
    const alert: Alert = { at: now().toISOString(), level, title, detail };
    await record(alert);

    if (level !== "info" && !hasExternal && !warnedNoExternal) {
      warnedNoExternal = true;
      logFn("[notify] 沒有設定警報外推管道（ALERT_WEBHOOK_URL 或 LINE_CHANNEL_ACCESS_TOKEN＋LINE_TO），warn/error 只寫在 log，沒有人會收到");
    }
    if (level !== "info") {
      const key = `${level}:${title}`;
      const last = lastPushedAt.get(key);
      const current = now().getTime();
      if (last === undefined || current - last >= throttleMs) {
        lastPushedAt.set(key, current);
        await pushExternal(alert);
      }
    }
    return alert;
  };
}
