import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppApi } from "./api.ts";
import { clipAudio, downloadAudio, prepareForGroq } from "./audio.ts";
import { DOWNLOAD_URL_TTL_SECONDS, signStoredAudioUrl } from "../src/lib/audio/signed-url.ts";
import { loadWorkerConfig, type WorkerConfig } from "./config.ts";
import {
  claimEpisode,
  createDb,
  deletePushSubscription,
  fetchQueuedEpisodes,
  insertReminderNotification,
  listPushSubscriptions,
  fetchReadyEpisodes,
  claimReadyNotified,
  markJournalReminded,
  saveTranscript,
  setEpisodeStatus,
  type WorkerDb,
} from "./db.ts";
import { transcribeWithMlx } from "./mlx.ts";
import { createEnrichDeps } from "./enrich-db.ts";
import { runEnrichBatch } from "./enrich-works.ts";
import { createNotifier, type Notify } from "./notify.ts";
import { processEpisode } from "./pipeline.ts";
import { createPushSender } from "./push.ts";
import { processReminders, type ReminderDeps } from "./reminders.ts";
import { processReadyNotifications } from "./ready.ts";
import { refreshEmbeddings } from "./embeddings.ts";
import { startDailyEventsCollection } from "./events/run.ts";
import { createListenRunner } from "./spotify-listen-run.ts";
import type { QueuedEpisode } from "./types.ts";

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(workerDir, "..");

// loadEnvFile 不覆蓋已存在的值 → 先載 dev 覆蓋檔，讓本地設定優先
for (const envFile of [".env.development.local", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(repoRoot, envFile));
  } catch {
    // 檔案不存在就跳過
  }
}

let stopping = false;

function log(line: string): void {
  console.log(`[${new Date().toISOString()}] ${line}`);
}

async function sleepUnlessStopping(ms: number): Promise<void> {
  const step = 1_000;
  let waited = 0;
  while (!stopping && waited < ms) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(step, ms - waited)));
    waited += step;
  }
}

async function handleEpisode(
  config: WorkerConfig,
  db: WorkerDb,
  api: ReturnType<typeof createAppApi>,
  notify: Notify,
  episode: QueuedEpisode,
): Promise<void> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "castflow-worker-"));
  try {
    const result = await processEpisode(
      {
        claim: (id) => claimEpisode(db, id),
        prepareAudio: async (audioUrl) => {
          // audio 儲存桶是 private：自家錄音換簽名網址，RSS 外部網址原樣下載
          const downloadUrl = await signStoredAudioUrl(db, audioUrl, DOWNLOAD_URL_TTL_SECONDS);
          const filePath = await downloadAudio(downloadUrl, tmpDir);
          return config.clipSeconds
            ? clipAudio(filePath, config.clipSeconds)
            : filePath;
        },
        transcribeLocal: (audioPath) =>
          transcribeWithMlx(audioPath, {
            bin: config.mlxBin,
            model: config.whisperModel,
            outputDir: tmpDir,
            timeoutMs: config.mlxTimeoutMs,
          }),
        transcribeFallback: async (id, audioPath) => {
          if (!audioPath) return api.transcribeFallback(id, null);
          const groqAudio = await prepareForGroq(audioPath);
          if (groqAudio.compressed) {
            log(`episode ${id} 音檔超過 Groq 上限，已壓縮為 16kHz 單聲道再上傳`);
          }
          return api.transcribeFallback(id, {
            data: await readFile(groqAudio.path),
            fileName: path.basename(groqAudio.path),
          });
        },
        saveTranscript: (id, transcription) => saveTranscript(db, id, transcription),
        setStatus: (id, status) => setEpisodeStatus(db, id, status),
        generate: (id) => api.generate(id),
        understand: (id) => api.understand(id),
        notify,
      },
      episode,
    );
    log(
      `episode ${episode.id} 處理結果：transcribedVia=${result.transcribedVia} generated=${result.generated} reading=${result.reading}${result.skipped ? "（已被其他流程認領，跳過）" : ""}`,
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function runCycle(
  config: WorkerConfig,
  db: WorkerDb,
  api: ReturnType<typeof createAppApi>,
  notify: Notify,
  sendPush: ReminderDeps["sendPush"],
  pollListening: (() => Promise<void>) | null,
): Promise<void> {
  try {
    const poll = await api.pollFeeds();
    if (poll.totalAdded > 0) {
      log(`RSS poll 新增 ${poll.totalAdded} 集`);
    }
  } catch (error) {
    await notify(
      "warn",
      "RSS poll 失敗（app API 無法呼叫？）",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 提醒派送輕量，排在轉錄（可能一跑數十分鐘）之前，避免被長集數拖延
  const reminders = await processReminders({
    fetchDue: () => api.fetchDueReminders(),
    createNotification: (reminder) => insertReminderNotification(db, reminder),
    listSubscriptions: () => listPushSubscriptions(db),
    sendPush,
    removeSubscription: (endpoint) => deletePushSubscription(db, endpoint),
    markReminded: (id) => markJournalReminded(db, id),
    notify,
  });
  if (reminders.due > 0) {
    log(
      `提醒派送：到期 ${reminders.due}、新通知 ${reminders.notified}、推播成功 ${reminders.pushed}／失敗 ${reminders.pushFailed}、寫 reminded_at ${reminders.marked}`,
    );
  }

  // 「整理好了」推播：App 端（說一段頁同步轉錄）轉好的錄音
  await pushReady(db, notify, sendPush);

  // 手動作品補資料：每輪最多 5 筆，同樣排在長時間轉錄之前
  if (config.tmdb) {
    const enrich = await runEnrichBatch(
      createEnrichDeps(db, { fetch, ...config.tmdb }, notify, log),
    );
    if (enrich.scanned > 0) {
      log(
        `補資料：掃描 ${enrich.scanned}、回填 ${enrich.done}、模糊 ${enrich.ambiguous}、查無 ${enrich.notFound}、重複 ${enrich.duplicate}、失敗 ${enrich.failed}`,
      );
    }
  }

  // 「在哪看」每日更新：app 端只挑快取過期的作品，平常這步是一次空查詢
  try {
    const watch = await api.refreshWatch();
    if (watch.scanned > 0) {
      log(`在哪看更新：掃描 ${watch.scanned}、更新 ${watch.updated}、失敗 ${watch.failed}`);
    }
    if (watch.failed > 0) {
      await notify("warn", "在哪看更新部分失敗", watch.errors.slice(0, 5).join("；"));
    }
  } catch (error) {
    await notify(
      "warn",
      "在哪看更新失敗（app API 無法呼叫？）",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 封面補齊：既有沒圖的 Podcast 作品補封面（iTunes → RSS），平常是一次空查詢
  try {
    const covers = await api.refreshCovers();
    if (covers.scanned > 0) {
      log(`補封面：掃描 ${covers.scanned}、補上 ${covers.filled}、仍無 ${covers.missing}、失敗 ${covers.failed}`);
    }
  } catch (error) {
    await notify("warn", "補封面失敗（app API 無法呼叫？）", error instanceof Error ? error.message : String(error));
  }

  await refreshEmbeddings(api, notify, log);

  // Spotify 收聽紀錄提醒（WORKER_SPOTIFY_LISTEN=on）：自己依間隔決定要不要拉，平常是直接返回
  if (pollListening) {
    try {
      await pollListening();
    } catch (error) {
      await notify("warn", "Spotify 收聽紀錄提醒失敗", error instanceof Error ? error.message : String(error));
    }
  }

  // 藝文活動每 N 天收一次（預設 7；EVENTS_SOURCES 指定來源，約 3 分鐘）：背景跑，不擋轉錄
  if (config.events.enabled) {
    startDailyEventsCollection({ api, notify, log, statePath: config.events.statePath, intervalDays: config.events.intervalDays, sources: config.events.sources });
  }

  let queue: QueuedEpisode[];
  try {
    queue = await fetchQueuedEpisodes(db, config.batchLimit);
  } catch (error) {
    await notify(
      "error",
      "讀取轉錄佇列失敗（Supabase 無法連線？）",
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  for (const episode of queue) {
    if (stopping) return;
    log(`開始處理 episode：${episode.title}（${episode.id}）`);
    await handleEpisode(config, db, api, notify, episode);
    // 本機轉好的立刻推，不等下一輪
    await pushReady(db, notify, sendPush);
  }
}

/** 說一段錄音轉成文字 → 推「整理好了」（冪等，可重複呼叫） */
async function pushReady(db: WorkerDb, notify: Notify, sendPush: ReminderDeps["sendPush"]): Promise<void> {
  const ready = await processReadyNotifications({
    fetchReady: () => fetchReadyEpisodes(db),
    claim: (id) => claimReadyNotified(db, id),
    listSubscriptions: () => listPushSubscriptions(db),
    sendPush,
    removeSubscription: (endpoint) => deletePushSubscription(db, endpoint),
    notify,
  });
  if (ready.ready > 0) {
    log(`整理好了推播：待推 ${ready.ready}、推播成功 ${ready.pushed}／失敗 ${ready.pushFailed}`);
  }
}

async function main(): Promise<void> {
  const config = loadWorkerConfig(process.env, workerDir);
  const notify = createNotifier({
    alertLogPath: config.alertLogPath,
    webhookUrl: config.alertWebhookUrl,
    lineToken: config.lineToken,
    lineTo: config.lineTo,
  });
  const db = createDb(config.supabaseUrl, config.supabaseServiceKey);
  const api = createAppApi(config.appUrl, config.apiSecretKey);
  const sendPush = config.vapid ? createPushSender(config.vapid) : null;

  const pushTargets = [
    config.alertWebhookUrl ? "webhook" : null,
    config.lineToken && config.lineTo ? "LINE" : null,
  ].filter(Boolean);
  log(
    `worker 啟動：model=${config.whisperModel} interval=${config.intervalMs}ms app=${config.appUrl} ` +
      `clip=${config.clipSeconds ?? "off"} webPush=${sendPush ? "on" : "off（未設 VAPID）"} 警報外推=${pushTargets.length ? pushTargets.join("+") : "無（僅 console+alerts.log）"}`,
  );

  if (!config.tmdb) {
    await notify("warn", "手動作品補資料停用", "未設 TMDB_READ_ACCESS_TOKEN / TMDB_API_KEY，enrich job 不會執行");
  }

  const pollListening = createListenRunner({ config: config.spotifyListen, db, notify, sendPush, log });
  if (config.spotifyListen.enabled && !pollListening) {
    await notify("warn", "Spotify 收聽紀錄提醒停用：設定不完整", config.spotifyListen.problem ?? "未知原因");
  }
  log(`Spotify 收聽紀錄提醒：${pollListening ? `on（每 ${config.spotifyListen.intervalMs / 60_000} 分）` : "off"}`);

  process.on("SIGINT", () => {
    log("收到 SIGINT，跑完當前集後停止…");
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });

  while (!stopping) {
    await runCycle(config, db, api, notify, sendPush, pollListening);
    if (process.env.WORKER_ONCE === "1") break;
    await sleepUnlessStopping(config.intervalMs);
  }
  log("worker 已停止");
}

main().catch((error) => {
  console.error(`[worker] 致命錯誤：${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
