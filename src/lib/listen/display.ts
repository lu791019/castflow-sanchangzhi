/** 閱讀頁顯示資料：把閱讀引擎產出／中文逐字稿整理成同一種段落與模式 */

import type { BilingualSegment, TranscriptSegment } from "@castflow/engine/types";
import { isChineseLanguage } from "@castflow/engine/transcribe/language";

export type ReadingMode = "listen" | "read" | "scan";
export type LangMode = "both" | "zh" | "source";

export const READING_MODES: ReadingMode[] = ["listen", "read", "scan"];
export const LANG_MODES: LangMode[] = ["both", "zh", "source"];

export interface DisplaySegment {
  start: number;
  end: number;
  speaker: string | null;
  /** 原文（英文節目是英文；中文節目就是中文逐字稿） */
  source: string;
  /** 繁中譯文；中文段落為 null */
  translated: string | null;
}

export interface DisplayChapter {
  title: string;
  start: number;
  /** 到下一章（或全集結尾）的秒數；最後一章不知道結尾時為 null */
  length: number | null;
}

export function parseReadingMode(value: string | string[] | undefined): ReadingMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "read" || raw === "scan" ? raw : "listen";
}

export function parseLangMode(value: string | null | undefined): LangMode {
  return value === "zh" || value === "source" ? value : "both";
}

export function fromBilingual(segments: readonly BilingualSegment[]): DisplaySegment[] {
  return segments.map((segment) => ({
    start: segment.start,
    end: segment.end,
    speaker: segment.speaker ?? null,
    source: segment.source_text,
    translated: isChineseLanguage(segment.source_lang) ? null : segment.translated_text,
  }));
}

/** 中文節目（閱讀引擎 skipped）：直接用逐字稿分段，沒有譯文 */
export function fromTranscript(segments: readonly TranscriptSegment[]): DisplaySegment[] {
  return segments
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => ({
      start: segment.start,
      end: segment.end,
      speaker: null,
      source: segment.text.trim(),
      translated: null,
    }));
}

export function hasTranslation(segments: readonly DisplaySegment[]): boolean {
  return segments.some((segment) => segment.translated !== null);
}

/** 依語言模式決定一段要顯示的兩行（null 表示該行不顯示） */
export function segmentLines(
  segment: DisplaySegment,
  mode: LangMode,
): { source: string | null; zh: string | null } {
  if (segment.translated === null) return { source: null, zh: segment.source };
  if (mode === "zh") return { source: null, zh: segment.translated };
  if (mode === "source") return { source: segment.source, zh: null };
  return { source: segment.source, zh: segment.translated };
}

export function withChapterLengths(
  chapters: ReadonlyArray<{ title: string; start: number }>,
  totalSeconds: number | null,
): DisplayChapter[] {
  return chapters.map((chapter, index) => {
    const next = chapters[index + 1]?.start ?? totalSeconds;
    return {
      title: chapter.title,
      start: chapter.start,
      length: next !== null && next !== undefined && next > chapter.start ? next - chapter.start : null,
    };
  });
}
