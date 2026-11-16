/**
 * 狀態 E（轉錄中）：三段進度與「大約還要 n 分鐘」估算。
 * 估算值依音檔長度 × 處理速率，介面一律標「大約」；音檔長度未知時不給數字。
 */

import type { ReadingStatus } from "@/lib/reading/service";

export type StageState = "done" | "active" | "queued" | "waiting";

export interface ProcessingStage {
  key: "transcribe" | "translate" | "layout";
  label: string;
  state: StageState;
}

/**
 * 處理速率（每 1 秒音檔需要的處理秒數）。
 * 2026-10-10 實測（The Daily〈Why France Is in Crisis〉26 分 28 秒，M 系列本機）：
 * 下載 + mlx-whisper medium q4 轉錄 257 秒 ≈ 0.16×；6 平台文案 + 雙語翻譯摘要 204 秒 ≈ 0.13×；排版幾乎即時。
 */
export const TRANSCRIBE_RATE = 0.16;
export const TRANSLATE_RATE = 0.13;

export interface ProcessingInput {
  hasTranscript: boolean;
  episodeStatus: string;
  readingStatus: ReadingStatus;
}

/** 閱讀資料已可顯示（雙語完成，或中文節目直接用逐字稿） */
export function isReadable(input: Pick<ProcessingInput, "hasTranscript" | "readingStatus">): boolean {
  if (input.readingStatus === "ready") return true;
  return input.readingStatus === "skipped" && input.hasTranscript;
}

function transcribeState(input: ProcessingInput): StageState {
  if (input.hasTranscript) return "done";
  return input.episodeStatus === "transcribing" ? "active" : "queued";
}

function translateState(input: ProcessingInput): StageState {
  if (input.readingStatus === "ready" || input.readingStatus === "skipped") return "done";
  if (!input.hasTranscript) return "waiting";
  return "active";
}

export function processingStages(input: ProcessingInput): ProcessingStage[] {
  return [
    { key: "transcribe", label: "轉錄", state: transcribeState(input) },
    { key: "translate", label: "翻譯", state: translateState(input) },
    { key: "layout", label: "排版", state: isReadable(input) ? "done" : "waiting" },
  ];
}

export const STAGE_SUFFIX: Record<StageState, string> = {
  done: "・完成",
  active: "・進行中",
  queued: "・排隊中",
  waiting: "",
};

/** 大約還要幾分鐘（無條件進位、至少 1）；音檔長度未知或已完成回 null */
export function estimateRemainingMinutes(
  durationSeconds: number | null,
  stages: readonly ProcessingStage[],
): number | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  const pending = (key: ProcessingStage["key"]) =>
    stages.find((stage) => stage.key === key)?.state !== "done";
  const seconds =
    (pending("transcribe") ? durationSeconds * TRANSCRIBE_RATE : 0) +
    (pending("translate") ? durationSeconds * TRANSLATE_RATE : 0);
  if (seconds <= 0 && !pending("layout")) return null;
  return Math.max(1, Math.ceil(seconds / 60));
}
