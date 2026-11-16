/**
 * 單次執行「手動作品補資料」一輪（最多 5 筆）＋「補封面」一輪（Podcast 最多 10 筆，走 app API）
 * ＋「詞向量補算」一輪（公開筆名文章最多 10 篇，走 app API）：npm run worker:enrich
 * env 與常駐 worker 相同（repo 根 .env.development.local 優先，再 .env.local；已存在的環境變數不被覆蓋）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppApi } from "./api.ts";
import { loadWorkerConfig } from "./config.ts";
import { createDb } from "./db.ts";
import { createEnrichDeps } from "./enrich-db.ts";
import { runEnrichBatch } from "./enrich-works.ts";
import { createNotifier } from "./notify.ts";
import { refreshEmbeddings } from "./embeddings.ts";

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
  if (!config.tmdb) {
    await notify("error", "手動作品補資料無法執行", "未設 TMDB_READ_ACCESS_TOKEN / TMDB_API_KEY");
    process.exit(1);
  }
  const db = createDb(config.supabaseUrl, config.supabaseServiceKey);
  const summary = await runEnrichBatch(createEnrichDeps(db, { fetch, ...config.tmdb }, notify, log));
  log(`補資料結果：${JSON.stringify(summary)}`);
  try {
    const covers = await createAppApi(config.appUrl, config.apiSecretKey).refreshCovers();
    log(`補封面結果：${JSON.stringify(covers)}`);
  } catch (error) {
    await notify("warn", "補封面失敗（app API 無法呼叫？）", error instanceof Error ? error.message : String(error));
  }
  await refreshEmbeddings(createAppApi(config.appUrl, config.apiSecretKey), notify, log);
}

main().catch((error) => {
  console.error(`[enrich] 致命錯誤：${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
