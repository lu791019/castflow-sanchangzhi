/**
 * 閱讀頁資料服務：讀逐字稿 → 跑閱讀引擎（雙語 + 摘要 + 章節）→ 落庫 episode_readings。
 * 存取層以 ReadingRepo 注入，服務本身不認識 Supabase（測試用假 repo）。
 */

import type {
  BilingualSegment,
  Chapter,
  ReadingResult,
  SummaryPoint,
  TranscriptSegment,
} from "@castflow/engine/types";
import type { ReadingOptions } from "@castflow/engine/understand/bilingual";
import { isChineseLanguage, normalizeLanguageCode } from "@castflow/engine/transcribe/language";

export type ReadingRowStatus = "pending" | "ready" | "error" | "skipped";
/** none：已有逐字稿但尚未產生；no_transcript：還沒轉錄 */
export type ReadingStatus = ReadingRowStatus | "none" | "no_transcript";

export interface TranscriptRecord {
  id: string;
  language: string;
  segments: TranscriptSegment[];
}

/** 落庫的摘要：新版每條 {text, start}；1e 初版是純字串（沒有時間戳，需重算） */
export type StoredSummaryItem = SummaryPoint | string;

/** 閱讀頁用的摘要：start 為 null 表示舊資料尚未重算時間戳 */
export interface ReadingSummaryItem {
  text: string;
  start: number | null;
}

export interface ReadingRow {
  transcript_id: string | null;
  status: ReadingRowStatus;
  source_language: string;
  segments: BilingualSegment[];
  summary: StoredSummaryItem[];
  chapters: Chapter[];
  error_message: string | null;
}

export interface ReadingRepo {
  getLatestTranscript(episodeId: string): Promise<TranscriptRecord | null>;
  getReading(episodeId: string): Promise<ReadingRow | null>;
  saveReading(episodeId: string, row: ReadingRow): Promise<void>;
}

export interface ReadingView {
  segments: BilingualSegment[];
  summary: ReadingSummaryItem[];
  /** 摘要是舊格式（沒有時間戳）→ 待重算（重跑 POST /api/episodes/[id]/reading） */
  summaryNeedsRecompute: boolean;
  chapters: Chapter[];
  language: string | null;
  status: ReadingStatus;
  /** 產出所依據的逐字稿已不是最新的一份（重新轉錄過） */
  stale: boolean;
  error: string | null;
}

export type BuildReadingFn = (
  segments: TranscriptSegment[],
  options: ReadingOptions,
) => Promise<ReadingResult>;

export interface GenerateDeps {
  repo: ReadingRepo;
  buildReading: BuildReadingFn;
  /** 透傳給引擎的批次設定（batchSize、concurrency…），language/llm 由服務決定 */
  engineOptions?: Omit<ReadingOptions, "language">;
}

export type GenerateOutcome =
  | { status: "ready"; segments: number; summary: number; chapters: number }
  | { status: "skipped"; reason: string };

export class NoTranscriptError extends Error {
  constructor(episodeId: string) {
    super(`episode ${episodeId} 尚無逐字稿`);
    this.name = "NoTranscriptError";
  }
}

function emptyRow(transcript: TranscriptRecord, status: ReadingRowStatus): ReadingRow {
  return {
    transcript_id: transcript.id,
    status,
    source_language: normalizeLanguageCode(transcript.language),
    segments: [],
    summary: [],
    chapters: [],
    error_message: null,
  };
}

/** 舊資料相容：純字串摘要轉成 start=null，並回報是否需要重算時間戳 */
export function normalizeSummary(stored: unknown): {
  items: ReadingSummaryItem[];
  needsRecompute: boolean;
} {
  if (!Array.isArray(stored)) return { items: [], needsRecompute: false };
  const items = stored.flatMap((item): ReadingSummaryItem[] => {
    if (typeof item === "string") {
      return item.trim() ? [{ text: item.trim(), start: null }] : [];
    }
    if (item && typeof item === "object" && typeof (item as SummaryPoint).text === "string") {
      const { text, start } = item as Partial<SummaryPoint>;
      const valid = typeof start === "number" && Number.isFinite(start) && start >= 0;
      return text && text.trim() ? [{ text: text.trim(), start: valid ? (start as number) : null }] : [];
    }
    return [];
  });
  return { items, needsRecompute: items.some((item) => item.start === null) };
}

/** 讀取閱讀頁資料（GET /api/episodes/[id]/reading 與之後的閱讀頁共用） */
export async function loadReading(repo: ReadingRepo, episodeId: string): Promise<ReadingView> {
  const [transcript, row] = await Promise.all([
    repo.getLatestTranscript(episodeId),
    repo.getReading(episodeId),
  ]);

  if (!row) {
    const status: ReadingStatus = !transcript
      ? "no_transcript"
      : isChineseLanguage(transcript.language)
        ? "skipped"
        : "none";
    return {
      segments: [],
      summary: [],
      summaryNeedsRecompute: false,
      chapters: [],
      language: transcript ? normalizeLanguageCode(transcript.language) : null,
      status,
      stale: false,
      error: null,
    };
  }

  const summary = normalizeSummary(row.summary);
  return {
    segments: row.segments,
    summary: summary.items,
    summaryNeedsRecompute: summary.needsRecompute,
    chapters: row.chapters,
    language: row.source_language,
    status: row.status,
    stale: !!transcript && row.transcript_id !== transcript.id,
    error: row.error_message,
  };
}

/**
 * 產生並落庫閱讀資料。中文節目標 skipped 不跑 LLM；
 * 失敗時落 error 狀態後重新拋出，由呼叫端（worker）推警報。
 */
export async function generateReading(
  deps: GenerateDeps,
  episodeId: string,
): Promise<GenerateOutcome> {
  const { repo } = deps;
  const transcript = await repo.getLatestTranscript(episodeId);
  if (!transcript) throw new NoTranscriptError(episodeId);

  if (isChineseLanguage(transcript.language)) {
    await repo.saveReading(episodeId, emptyRow(transcript, "skipped"));
    return { status: "skipped", reason: "中文節目不需雙語對照" };
  }

  await repo.saveReading(episodeId, emptyRow(transcript, "pending"));
  try {
    const result = await deps.buildReading(transcript.segments, {
      ...deps.engineOptions,
      language: transcript.language,
    });
    await repo.saveReading(episodeId, {
      transcript_id: transcript.id,
      status: "ready",
      source_language: result.language,
      segments: result.segments,
      summary: result.summary,
      chapters: result.chapters,
      error_message: null,
    });
    return {
      status: "ready",
      segments: result.segments.length,
      summary: result.summary.length,
      chapters: result.chapters.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await repo.saveReading(episodeId, { ...emptyRow(transcript, "error"), error_message: message });
    throw error;
  }
}
