/** app API 客戶端：worker 與既有管線的唯一 HTTP 接點（x-api-key 守衛） */

import type { CollectedEvent, EventSource } from "../src/lib/events/collected.ts";
import type { IngestSummary } from "./events/collect.ts";
import type { DueReminder } from "./reminders.ts";

export interface PollResult {
  totalAdded: number;
}

export interface FallbackAudio {
  data: Uint8Array<ArrayBuffer>;
  fileName: string;
}

export interface AppApi {
  pollFeeds(): Promise<PollResult>;
  /**
   * 既有 Groq 路徑：/api/transcribe 自己寫 transcript 與狀態。
   * 帶 audio 時以 multipart 上傳 worker 已壓縮的本機檔；null 則由 app 自行下載 audio_url。
   */
  transcribeFallback(episodeId: string, audio: FallbackAudio | null): Promise<void>;
  generate(episodeId: string): Promise<void>;
  /** 閱讀引擎：雙語對照 + 摘要 + 章節（中文節目 app 端回 skipped） */
  understand(episodeId: string): Promise<UnderstandResult>;
  /** 視聽日誌：到期且未提醒的紀錄（app 端組好通知文案） */
  fetchDueReminders(): Promise<DueReminder[]>;
  /** 「在哪看」每日更新：app 端挑快取過期的作品重抓（每輪最多 10 筆） */
  refreshWatch(): Promise<WatchRefreshResult>;
  /** 封面補齊：既有沒圖的 Podcast 作品補封面（每輪最多 10 筆） */
  refreshCovers(): Promise<CoverRefreshResult>;
  /** 詞向量補算：公開筆名文章沒算過或內文改過的（每輪最多 10 篇；沒有 VOYAGE_API_KEY 時全數 skipped） */
  refreshEmbeddings(): Promise<EmbeddingRefreshResult>;
  /** 藝文活動：一個來源一次送（worker 每天收一次，Cloud Run 只讀） */
  ingestEvents(source: EventSource, events: CollectedEvent[]): Promise<IngestSummary>;
}

function isIngestSummary(value: unknown): value is IngestSummary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return ["received", "upserted", "invalid", "merged", "pruned"].every((key) => typeof v[key] === "number");
}

export interface EmbeddingRefreshResult {
  scanned: number;
  embedded: number;
  skipped: number;
  failed: number;
  errors: string[];
}

function isEmbeddingRefreshResult(value: unknown): value is EmbeddingRefreshResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.scanned === "number" &&
    typeof v.embedded === "number" &&
    typeof v.skipped === "number" &&
    typeof v.failed === "number" &&
    Array.isArray(v.errors)
  );
}

export interface CoverRefreshResult {
  scanned: number;
  filled: number;
  missing: number;
  failed: number;
  errors: string[];
}

function isCoverRefreshResult(value: unknown): value is CoverRefreshResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.scanned === "number" &&
    typeof v.filled === "number" &&
    typeof v.missing === "number" &&
    typeof v.failed === "number" &&
    Array.isArray(v.errors)
  );
}

export interface WatchRefreshResult {
  scanned: number;
  updated: number;
  failed: number;
  errors: string[];
}

function isWatchRefreshResult(value: unknown): value is WatchRefreshResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.scanned === "number" &&
    typeof v.updated === "number" &&
    typeof v.failed === "number" &&
    Array.isArray(v.errors)
  );
}

export interface UnderstandResult {
  status: string;
}

const POLL_TIMEOUT_MS = 30_000;
const DUE_TIMEOUT_MS = 30_000;
const WATCH_REFRESH_TIMEOUT_MS = 2 * 60_000;
const TRANSCRIBE_TIMEOUT_MS = 10 * 60_000;
const GENERATE_TIMEOUT_MS = 10 * 60_000;
/** 長節目分批翻譯（數十批 LLM 呼叫）可能要很久 */
const UNDERSTAND_TIMEOUT_MS = 45 * 60_000;
const EVENTS_INGEST_TIMEOUT_MS = 2 * 60_000;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // 非 JSON 回應時退回狀態碼
  }
  return `HTTP ${response.status}`;
}

export function createAppApi(
  appUrl: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): AppApi {
  async function call(
    method: "GET" | "POST",
    apiPath: string,
    timeoutMs: number,
    body?: unknown,
  ): Promise<Response> {
    const isForm = body instanceof FormData;
    const isJson = body !== undefined && !isForm;
    const response = await fetchFn(`${appUrl}${apiPath}`, {
      method,
      headers: {
        "x-api-key": apiKey,
        ...(isJson ? { "Content-Type": "application/json" } : {}),
      },
      ...(isForm ? { body } : {}),
      ...(isJson ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`${apiPath} 失敗：${await readErrorMessage(response)}`);
    }
    return response;
  }

  return {
    async pollFeeds() {
      const response = await call("GET", "/api/ingest/rss/poll", POLL_TIMEOUT_MS);
      const data = (await response.json()) as { totalAdded?: number };
      return { totalAdded: data.totalAdded ?? 0 };
    },
    async transcribeFallback(episodeId, audio) {
      if (!audio) {
        await call("POST", "/api/transcribe", TRANSCRIBE_TIMEOUT_MS, { episodeId });
        return;
      }
      const form = new FormData();
      form.append("episodeId", episodeId);
      form.append(
        "audio",
        new File([audio.data], audio.fileName, { type: "audio/mpeg" }),
      );
      await call("POST", "/api/transcribe", TRANSCRIBE_TIMEOUT_MS, form);
    },
    async generate(episodeId) {
      await call("POST", "/api/generate", GENERATE_TIMEOUT_MS, { episodeId });
    },
    async understand(episodeId) {
      const response = await call(
        "POST",
        `/api/episodes/${encodeURIComponent(episodeId)}/reading`,
        UNDERSTAND_TIMEOUT_MS,
        {},
      );
      const data = (await response.json()) as { status?: unknown };
      return { status: typeof data.status === "string" ? data.status : "unknown" };
    },
    async fetchDueReminders() {
      const response = await call("GET", "/api/journal/due", DUE_TIMEOUT_MS);
      const data = (await response.json()) as { reminders?: unknown };
      if (!Array.isArray(data.reminders)) {
        throw new Error("/api/journal/due 回應缺少 reminders 陣列");
      }
      return data.reminders as DueReminder[];
    },
    async refreshWatch() {
      const response = await call("POST", "/api/works/watch/refresh", WATCH_REFRESH_TIMEOUT_MS, {});
      const body = (await response.json()) as { data?: unknown };
      if (!isWatchRefreshResult(body.data)) {
        throw new Error("/api/works/watch/refresh 回應格式不對（在哪看更新）");
      }
      return body.data;
    },

    async refreshCovers() {
      const response = await call("POST", "/api/works/covers/refresh", WATCH_REFRESH_TIMEOUT_MS, {});
      const body = (await response.json()) as { data?: unknown };
      if (!isCoverRefreshResult(body.data)) {
        throw new Error("/api/works/covers/refresh 回應格式不對（補封面）");
      }
      return body.data;
    },

    async refreshEmbeddings() {
      const response = await call("POST", "/api/episodes/embeddings/refresh", WATCH_REFRESH_TIMEOUT_MS, {});
      const body = (await response.json()) as { data?: unknown };
      if (!isEmbeddingRefreshResult(body.data)) {
        throw new Error("/api/episodes/embeddings/refresh 回應格式不對（詞向量補算）");
      }
      return body.data;
    },

    async ingestEvents(source, events) {
      const response = await call("POST", "/api/events/ingest", EVENTS_INGEST_TIMEOUT_MS, { source, events });
      const body = (await response.json()) as { data?: unknown };
      if (!isIngestSummary(body.data)) {
        throw new Error("/api/events/ingest 回應格式不對（藝文活動）");
      }
      return body.data;
    },
  };
}
