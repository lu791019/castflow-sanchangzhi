/**
 * 第 0 步「看完了」生成（Q-69～Q-86）：Threads 貼文與部落格長文。
 * 長度只重試、不截斷（LLM 輸出一律不硬切）；拒絕標記一律丟 GenerationRefusedError，呼叫端不得寫成正文。
 */

import { runClaudePrint } from "../llm/client";
import { countChineseChars } from "./article-length";
import type { GenerateOptions } from "./generate-content";
import { GenerationRefusedError, isRefusal } from "./refusal";
import {
  buildWatchedLongformPrompt,
  buildWatchedShortenPrompt,
  buildWatchedThreadsPrompt,
  LONGFORM_MAX_CHARS,
  LONGFORM_MIN_SOURCE_CHARS,
  WATCHED_THREADS_MAX_CHARS,
  type WatchedPromptInput,
} from "./watched-prompt";

/** Threads 算所有字元（含標點、換行、emoji 算一個） */
export function threadsLength(text: string): number {
  return Array.from(text).length;
}

/** 長文素材夠不夠（Q-86）：原話的中文字數 */
export function canWriteLongform(transcript: string): boolean {
  return countChineseChars(transcript) >= LONGFORM_MIN_SOURCE_CHARS;
}

/** 模型偶爾整段包在引號或 code fence 裡；只剝最外層，不動內文 */
export function cleanOutput(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  const inner = fenced ? fenced[1].trim() : trimmed;
  const quoted = inner.match(/^[「"“]([\s\S]*)[」"”]$/);
  // 內文還有引號就不是整段被包住（例：「一句」中間「另一句」），原樣保留
  return quoted && !/[「」"“”]/.test(quoted[1]) ? quoted[1].trim() : inner;
}

async function rejectIfRefused(text: string, kind: string, options?: GenerateOptions): Promise<void> {
  if (!isRefusal(text)) return;
  const error = new GenerationRefusedError(kind, text);
  await options?.notify?.("warn", `看完了：AI 拒絕整理${kind}`, error.excerpt);
  throw error;
}

async function withinLimit(
  first: string,
  prompt: string,
  isOver: (text: string) => boolean,
  limitLabel: string,
  options?: GenerateOptions,
): Promise<string> {
  if (!isOver(first)) return first;
  const retried = cleanOutput(await runClaudePrint(buildWatchedShortenPrompt(prompt, first, limitLabel), options));
  if (retried && !isRefusal(retried) && !isOver(retried)) return retried;
  await options?.notify?.("warn", "看完了：重試後仍超過長度", `${limitLabel}；已保留結果未截斷`);
  return retried && !isRefusal(retried) ? retried : first;
}

export async function generateWatchedThreads(input: WatchedPromptInput, options?: GenerateOptions): Promise<string> {
  const prompt = buildWatchedThreadsPrompt(input);
  const text = cleanOutput(await runClaudePrint(prompt, options));
  await rejectIfRefused(text, "Threads 貼文", options);
  return withinLimit(
    text,
    prompt,
    (t) => threadsLength(t) > WATCHED_THREADS_MAX_CHARS,
    ` Threads 上限 ${WATCHED_THREADS_MAX_CHARS} 字`,
    options,
  );
}

export class LongformSourceTooShortError extends Error {
  constructor() {
    super(`原話不到 ${LONGFORM_MIN_SOURCE_CHARS} 字，寫成長文會灌水；再多說一點`);
    this.name = "LongformSourceTooShortError";
  }
}

export async function generateWatchedLongform(input: WatchedPromptInput, options?: GenerateOptions): Promise<string> {
  if (!canWriteLongform(input.transcript)) throw new LongformSourceTooShortError();
  const prompt = buildWatchedLongformPrompt(input);
  const text = cleanOutput(await runClaudePrint(prompt, options));
  await rejectIfRefused(text, "長文", options);
  return withinLimit(
    text,
    prompt,
    (t) => countChineseChars(t) > LONGFORM_MAX_CHARS,
    ` ${LONGFORM_MAX_CHARS} 字`,
    options,
  );
}
