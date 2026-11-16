/**
 * 閱讀引擎：逐字稿分段 → 雙語對照（原文 + 繁中）＋ 3–5 條摘要 ＋ 章節。
 *
 * - 只翻譯非中文分段；中文分段 translated_text = null
 * - 翻譯分批送 LLM（batchSize 可設），避免單次呼叫過長而 timeout
 * - 每批輸出走 schema 驗證，不合格整批重試（maxAttempts）
 * - 引擎不碰 DB；LLM 呼叫可注入（測試用 mock、app 用 DB 設定）
 */

import { runClaudePrint, type RunClaudePrintOptions } from "../llm/client";
import { isChineseLanguage, normalizeLanguageCode } from "../transcribe/language";
import type { BilingualSegment, ReadingResult } from "../types";
import {
  buildOverviewPrompt,
  buildTranslationPrompt,
  parseOverviewOutput,
  parseTranslationOutput,
  type OverviewOutput,
} from "./bilingual-prompt";

export interface ReadingInputSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  /** 分段語言；缺省時用整集語言（中文字比例過半則視為中文） */
  lang?: string;
}

export type LlmCall = (prompt: string) => Promise<string>;

export interface ReadingOptions {
  /** 整集偵測到的語言（en / zh / "English"…皆可） */
  language: string;
  /** 每批送 LLM 的段數 */
  batchSize?: number;
  /** 每批（或摘要）最多嘗試次數 */
  maxAttempts?: number;
  /** 每批附帶的前文段數（只供語境、不翻譯） */
  contextSize?: number;
  /** 同時進行的批數 */
  concurrency?: number;
  llm?: LlmCall;
  llmOptions?: RunClaudePrintOptions;
  onProgress?: (done: number, total: number) => void;
}

export const DEFAULT_BATCH_SIZE = 40;
export const DEFAULT_MAX_ATTEMPTS = 2;
export const DEFAULT_CONTEXT_SIZE = 2;
export const DEFAULT_CONCURRENCY = 1;
/** 摘要輸入的時間軸行數上限（長節目合併成較粗的時間塊，控制 prompt 長度） */
export const MAX_TIMELINE_LINES = 180;
const MIN_TIMELINE_WINDOW_SECONDS = 20;

const CJK_CHAR_GLOBAL = /[㐀-䶿一-鿿豈-﫿]/g;

function resolveLlm(options: ReadingOptions): LlmCall {
  return options.llm ?? ((prompt) => runClaudePrint(prompt, options.llmOptions));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 分段語言：明確標註優先；否則中文字比例過半視為中文，其餘沿用整集語言 */
export function segmentLanguage(segment: ReadingInputSegment, episodeLanguage: string): string {
  if (segment.lang) return normalizeLanguageCode(segment.lang);
  const visible = segment.text.replace(/\s/g, "");
  const cjkCount = (visible.match(CJK_CHAR_GLOBAL) ?? []).length;
  if (visible.length > 0 && cjkCount / visible.length > 0.5) return "zh";
  return normalizeLanguageCode(episodeLanguage);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`batchSize 必須是正整數，收到：${size}`);
  }
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function withRetry<T>(label: string, maxAttempts: number, run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${label} 失敗（嘗試 ${maxAttempts} 次）：${messageOf(lastError)}`);
}

async function runInPool<T>(tasks: ReadonlyArray<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, lane);
  await Promise.all(lanes);
  return results;
}

/** 雙語對照：非中文分段分批翻譯成繁中，中文分段原樣保留 */
export async function translateSegments(
  segments: readonly ReadingInputSegment[],
  options: ReadingOptions,
): Promise<BilingualSegment[]> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const contextSize = options.contextSize ?? DEFAULT_CONTEXT_SIZE;
  const llm = resolveLlm(options);

  const cleaned = segments
    .map((s) => ({ ...s, text: s.text.trim() }))
    .filter((s) => s.text.length > 0);
  const langs = cleaned.map((s) => segmentLanguage(s, options.language));
  const toTranslate = cleaned
    .map((_, index) => index)
    .filter((index) => !isChineseLanguage(langs[index]));

  const batches = chunk(toTranslate, batchSize);
  let done = 0;
  const tasks = batches.map((ids, batchIndex) => async () => {
    const firstIndex = ids[0];
    const context = cleaned
      .slice(Math.max(0, firstIndex - contextSize), firstIndex)
      .map((s) => s.text);
    const items = ids.map((id) => ({ id, text: cleaned[id].text }));
    const prompt = buildTranslationPrompt(items, langs[firstIndex], context);
    const translated = await withRetry(
      `翻譯第 ${batchIndex + 1}/${batches.length} 批`,
      maxAttempts,
      async () => parseTranslationOutput(await llm(prompt), ids),
    );
    done += 1;
    options.onProgress?.(done, batches.length);
    return translated;
  });

  const merged = new Map<number, string>();
  for (const batch of await runInPool(tasks, options.concurrency ?? DEFAULT_CONCURRENCY)) {
    batch.forEach((zh, id) => merged.set(id, zh));
  }

  return cleaned.map((s, index) => ({
    start: s.start,
    end: s.end,
    ...(s.speaker ? { speaker: s.speaker } : {}),
    source_text: s.text,
    source_lang: langs[index],
    translated_text: merged.get(index) ?? null,
  }));
}

function formatSeconds(seconds: number): string {
  return String(Math.round(seconds * 10) / 10);
}

/** 把分段合併成「[秒數] 文字」時間軸；長節目自動放大時間窗，行數不超過 maxLines */
export function buildTimeline(
  segments: readonly ReadingInputSegment[],
  maxLines: number = MAX_TIMELINE_LINES,
): string {
  if (!segments.length) return "";
  const duration = segments[segments.length - 1].end;
  const window = Math.max(MIN_TIMELINE_WINDOW_SECONDS, Math.ceil(duration / maxLines));

  const blocks: Array<{ start: number; texts: string[] }> = [];
  for (const s of segments) {
    const text = s.text.trim();
    if (!text) continue;
    const current = blocks[blocks.length - 1];
    if (current && s.start - current.start < window) {
      current.texts.push(text);
    } else {
      blocks.push({ start: s.start, texts: [text] });
    }
  }
  return blocks.map((b) => `[${formatSeconds(b.start)}] ${b.texts.join(" ")}`).join("\n");
}

/** 3–5 條摘要 + 章節（標題 + 起始秒數，吸附到段落起點） */
export async function summarizeTranscript(
  segments: readonly ReadingInputSegment[],
  options: ReadingOptions,
): Promise<OverviewOutput> {
  const usable = segments.filter((s) => s.text.trim().length > 0);
  if (!usable.length) {
    throw new Error("逐字稿沒有可用分段，無法產生摘要");
  }
  const llm = resolveLlm(options);
  const duration = usable[usable.length - 1].end;
  const prompt = buildOverviewPrompt(
    buildTimeline(usable),
    normalizeLanguageCode(options.language),
    duration,
  );
  const starts = usable.map((s) => s.start);
  return withRetry("摘要與章節", options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, async () =>
    parseOverviewOutput(await llm(prompt), starts),
  );
}

/** 閱讀頁完整產出：雙語分段 + 摘要 + 章節 */
export async function buildReading(
  segments: readonly ReadingInputSegment[],
  options: ReadingOptions,
): Promise<ReadingResult> {
  const bilingual = await translateSegments(segments, options);
  const overview = await summarizeTranscript(segments, options);
  return {
    segments: bilingual,
    summary: overview.summary,
    chapters: overview.chapters,
    language: normalizeLanguageCode(options.language),
  };
}
