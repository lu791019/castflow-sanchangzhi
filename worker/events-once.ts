/**
 * 手動跑一輪藝文活動收集（不看上次什麼時候跑）：npm run worker:events；EVENTS_SOURCES=opentix,tfam 只跑指定來源
 * env 與常駐 worker 相同（repo 根 .env.development.local 優先，再 .env.local；已存在的環境變數不被覆蓋）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppApi } from "./api.ts";
import { loadWorkerConfig } from "./config.ts";
import { runEventsCollection } from "./events/run.ts";
import { createNotifier } from "./notify.ts";

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(workerDir, "..");

for (const envFile of [".env.development.local", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(repoRoot, envFile));
  } catch {
    // 檔案不存在就跳過
  }
}

function log(line: string): void {
  console.log(`[${new Date().toISOString()}] ${line}`);
}

async function main(): Promise<void> {
  const config = loadWorkerConfig(process.env, workerDir);
  const notify = createNotifier({
    alertLogPath: config.alertLogPath,
    webhookUrl: config.alertWebhookUrl,
    lineToken: config.lineToken,
    lineTo: config.lineTo,
  });
  const reports = await runEventsCollection(
    { api: createAppApi(config.appUrl, config.apiSecretKey), notify, log, statePath: config.events.statePath, intervalDays: config.events.intervalDays, sources: config.events.sources },
    true,
  );
  const failed = (reports ?? []).filter((report) => !report.ok);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[events] 致命錯誤：${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
