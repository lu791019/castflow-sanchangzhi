import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TranscriptionResult, TranscriptSegment } from "./types.ts";

const execFileAsync = promisify(execFile);

/** mlx 轉錄子程序 stdout/stderr 上限（模型下載進度條可能很長） */
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export interface MlxTranscribeOptions {
  bin: string;
  model: string;
  outputDir: string;
  timeoutMs: number;
}

export function buildMlxArgs(
  audioPath: string,
  outputName: string,
  options: Pick<MlxTranscribeOptions, "model" | "outputDir">,
): string[] {
  return [
    audioPath,
    "--model",
    options.model,
    "--output-dir",
    options.outputDir,
    "--output-name",
    outputName,
    "--output-format",
    "json",
    "--verbose",
    "False",
  ];
}

/** 解析 mlx-whisper 的 JSON 輸出（text/segments/language），過濾畸形 segment */
export function parseMlxResult(raw: string): TranscriptionResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("mlx-whisper 輸出不是合法 JSON");
  }

  const record = data as {
    text?: unknown;
    segments?: unknown;
    language?: unknown;
  };
  if (typeof record.text !== "string" || !record.text.trim()) {
    throw new Error("mlx-whisper 輸出缺少 text 內容");
  }

  const rawSegments = Array.isArray(record.segments) ? record.segments : [];
  const segments: TranscriptSegment[] = [];
  for (const item of rawSegments) {
    const segment = item as { start?: unknown; end?: unknown; text?: unknown };
    if (
      typeof segment.start === "number" &&
      typeof segment.end === "number" &&
      typeof segment.text === "string"
    ) {
      segments.push({
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
      });
    }
  }

  return {
    fullText: record.text.trim(),
    segments,
    language: typeof record.language === "string" ? record.language : "unknown",
  };
}

/** 跑 mlx_whisper CLI 轉錄本機音檔；首跑會自動下載模型（q4 medium 約 500MB） */
export async function transcribeWithMlx(
  audioPath: string,
  options: MlxTranscribeOptions,
): Promise<TranscriptionResult> {
  const outputName = `mlx-${Date.now()}`;
  try {
    await execFileAsync(
      options.bin,
      buildMlxArgs(audioPath, outputName, options),
      { timeout: options.timeoutMs, maxBuffer: MAX_BUFFER_BYTES },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`mlx-whisper 執行失敗：${detail}`);
  }

  const jsonPath = path.join(options.outputDir, `${outputName}.json`);
  const raw = await readFile(jsonPath, "utf8");
  return parseMlxResult(raw);
}
