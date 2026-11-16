import path from "node:path";
import { EVENT_SOURCES, type EventSource } from "../src/lib/events/collected.ts";
import { spotifyCredentialsFromEnv, type SpotifyCredentials } from "../src/lib/spotify/api.ts";
import { tokenKeyFromEnv } from "../src/lib/spotify/token-crypto.ts";

export interface WorkerConfig {
  appUrl: string;
  apiSecretKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  intervalMs: number;
  batchLimit: number;
  whisperModel: string;
  mlxBin: string;
  mlxTimeoutMs: number;
  /** 設定時先用 ffmpeg 裁前 N 秒再轉錄（驗證/試跑用），正式跑留空 */
  clipSeconds: number | null;
  alertLogPath: string;
  alertWebhookUrl: string | null;
  lineToken: string | null;
  lineTo: string | null;
  /** Web Push：公私鑰齊備才啟用，否則只寫 App 內通知 */
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  /** 手動作品補資料（TMDB）：token 或 key 擇一；都沒有則停用該 job（啟動時 warn） */
  tmdb: { readAccessToken: string | null; apiKey: string | null } | null;
  /** 藝文活動收集：每 intervalDays 天一次（預設 7）、只收 sources；WORKER_EVENTS=off 停用 */
  events: { enabled: boolean; statePath: string; intervalDays: number; sources: EventSource[] };
  /**
   * Spotify 收聽紀錄提醒（Q-64 C1）：WORKER_SPOTIFY_LISTEN=on 才跑（預設關）；每 SPOTIFY_LISTEN_INTERVAL_MINUTES 分（預設 20，5–120）。
   * 要 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET 與 SPOTIFY_TOKEN_KEY；開了但缺 → problem 寫原因，啟動時警報並停用。
   */
  spotifyListen: {
    enabled: boolean;
    intervalMs: number;
    credentials: SpotifyCredentials | null;
    tokenKey: Buffer | null;
    problem: string | null;
  };
}

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "API_SECRET_KEY",
] as const;

export const DEFAULT_INTERVAL_MS = 60_000;
export const DEFAULT_BATCH_LIMIT = 2;
export const DEFAULT_WHISPER_MODEL = "mlx-community/whisper-medium-mlx-q4";
const DEFAULT_MLX_BIN = "mlx_whisper";
// 8GB 機器實測 78 分鐘的集數要轉約 85 分鐘（11/9 EP13）；30 分鐘上限會讓長集數必定降級
const DEFAULT_MLX_TIMEOUT_MS = 3 * 60 * 60_000;
const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_VAPID_SUBJECT = "mailto:castflow@example.com";
const DEFAULT_EVENTS_INTERVAL_DAYS = 7;
export const DEFAULT_SPOTIFY_LISTEN_INTERVAL_MINUTES = 20;
const SPOTIFY_LISTEN_INTERVAL_RANGE = [5, 120] as const;

function readSpotifyListenInterval(env: Record<string, string | undefined>): number {
  const value = readPositiveNumber(env, "SPOTIFY_LISTEN_INTERVAL_MINUTES", DEFAULT_SPOTIFY_LISTEN_INTERVAL_MINUTES);
  const [min, max] = SPOTIFY_LISTEN_INTERVAL_RANGE;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`SPOTIFY_LISTEN_INTERVAL_MINUTES 必須是 ${min}–${max} 的整數，收到：${env.SPOTIFY_LISTEN_INTERVAL_MINUTES}`);
  }
  return value * 60_000;
}

function readSpotifyListen(env: Record<string, string | undefined>): WorkerConfig["spotifyListen"] {
  const enabled = env.WORKER_SPOTIFY_LISTEN?.trim().toLowerCase() === "on";
  const intervalMs = readSpotifyListenInterval(env);
  const credentials = spotifyCredentialsFromEnv(env);
  let tokenKey: Buffer | null = null;
  let keyProblem: string | null = null;
  try {
    tokenKey = tokenKeyFromEnv(env);
  } catch (error) {
    keyProblem = error instanceof Error ? error.message : String(error);
  }
  const problems = [credentials ? null : "沒有 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET", keyProblem].filter(Boolean);
  return { enabled, intervalMs, credentials, tokenKey, problem: problems.length > 0 ? problems.join("；") : null };
}

function readEventsIntervalDays(env: Record<string, string | undefined>): number {
  const value = readPositiveNumber(env, "EVENTS_INTERVAL_DAYS", DEFAULT_EVENTS_INTERVAL_DAYS);
  if (!Number.isInteger(value)) throw new Error(`EVENTS_INTERVAL_DAYS 必須是正整數，收到：${env.EVENTS_INTERVAL_DAYS}`);
  return value;
}

/** Dex 10/15 讀條款後決定不自動收：KKTIX 條款明文禁 Bot 存取、Accupass 限「只能透過其介面」。要收得在 EVENTS_SOURCES 明寫 */
const TERMS_BLOCKED_SOURCES: readonly EventSource[] = ["kktix", "accupass"];
/** EVENTS_SOURCES 沒給時收的來源：全部扣掉條款禁止的 */
export const DEFAULT_EVENT_SOURCES: readonly EventSource[] = EVENT_SOURCES.filter((source) => !TERMS_BLOCKED_SOURCES.includes(source));

/** EVENTS_SOURCES=opentix,tfam（逗號分隔）；不給就 DEFAULT_EVENT_SOURCES */
function readEventSources(env: Record<string, string | undefined>): EventSource[] {
  const raw = env.EVENTS_SOURCES;
  if (raw === undefined || raw === "") return [...DEFAULT_EVENT_SOURCES];
  const names = [...new Set(raw.split(",").map((name) => name.trim().toLowerCase()).filter(Boolean))];
  const unknown = names.filter((name) => !(EVENT_SOURCES as readonly string[]).includes(name));
  if (names.length === 0 || unknown.length > 0) {
    throw new Error(`EVENTS_SOURCES 只能是 ${EVENT_SOURCES.join("、")}，收到：${raw}`);
  }
  return names as EventSource[];
}

function readPositiveNumber(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} 必須是正數，收到：${raw}`);
  }
  return value;
}

function readOptional(
  env: Record<string, string | undefined>,
  key: string,
): string | null {
  const raw = env[key];
  return raw && raw.trim() ? raw.trim() : null;
}

function readVapid(env: Record<string, string | undefined>): WorkerConfig["vapid"] {
  const publicKey = readOptional(env, "VAPID_PUBLIC_KEY");
  const privateKey = readOptional(env, "VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: readOptional(env, "VAPID_SUBJECT") ?? DEFAULT_VAPID_SUBJECT,
  };
}

function readTmdb(env: Record<string, string | undefined>): WorkerConfig["tmdb"] {
  const readAccessToken = readOptional(env, "TMDB_READ_ACCESS_TOKEN");
  const apiKey = readOptional(env, "TMDB_API_KEY");
  return readAccessToken || apiKey ? { readAccessToken, apiKey } : null;
}

/** 從環境變數組出 worker 設定；缺必填鍵時一次列出全部缺項 */
export function loadWorkerConfig(
  env: Record<string, string | undefined>,
  workerDir: string,
): WorkerConfig {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`缺少必要環境變數：${missing.join(", ")}`);
  }

  const clipRaw = env.WORKER_CLIP_SECONDS;
  const clipSeconds =
    clipRaw === undefined || clipRaw === ""
      ? null
      : readPositiveNumber(env, "WORKER_CLIP_SECONDS", 0);

  return {
    appUrl: (env.APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, ""),
    apiSecretKey: env.API_SECRET_KEY as string,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL as string,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
    intervalMs: readPositiveNumber(env, "WORKER_INTERVAL_MS", DEFAULT_INTERVAL_MS),
    batchLimit: readPositiveNumber(env, "WORKER_BATCH_LIMIT", DEFAULT_BATCH_LIMIT),
    whisperModel: env.WHISPER_MODEL?.trim() || DEFAULT_WHISPER_MODEL,
    mlxBin: env.MLX_WHISPER_BIN?.trim() || DEFAULT_MLX_BIN,
    mlxTimeoutMs: readPositiveNumber(env, "MLX_TIMEOUT_MS", DEFAULT_MLX_TIMEOUT_MS),
    clipSeconds,
    alertLogPath:
      readOptional(env, "ALERT_LOG_PATH") ?? path.join(workerDir, "alerts.log"),
    alertWebhookUrl: readOptional(env, "ALERT_WEBHOOK_URL"),
    lineToken: readOptional(env, "LINE_CHANNEL_ACCESS_TOKEN"),
    lineTo: readOptional(env, "LINE_TO"),
    vapid: readVapid(env),
    tmdb: readTmdb(env),
    events: {
      enabled: env.WORKER_EVENTS?.trim().toLowerCase() !== "off",
      statePath: readOptional(env, "EVENTS_STATE_PATH") ?? path.join(workerDir, "events-state.json"),
      intervalDays: readEventsIntervalDays(env),
      sources: readEventSources(env),
    },
    spotifyListen: readSpotifyListen(env),
  };
}
