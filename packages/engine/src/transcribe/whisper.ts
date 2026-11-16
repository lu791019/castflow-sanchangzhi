import Groq from "groq-sdk";
import type { TranscriptSegment } from "../types";
import { joinSegmentTexts, normalizeLanguageCode } from "./language";

let groqClient: Groq | null = null;

/** 延遲建立 client：import 本模組（如測試純函式）不需要 GROQ_API_KEY */
function getGroq(): Groq {
  groqClient ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptSegment[];
  language: string;
}

export async function transcribeAudio(
  audioUrl: string,
): Promise<TranscriptionResult> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Audio download failed: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return transcribeAudioBuffer(buffer, "audio.mp3");
}

/** 直接轉錄已在手上的音訊（如本機 worker 壓縮後上傳的檔） */
export async function transcribeAudioBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<TranscriptionResult> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(
      `Audio file too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB). Max ${MAX_FILE_SIZE / 1024 / 1024}MB. Please compress before uploading.`,
    );
  }

  const file = new File([buffer], fileName, { type: "audio/mpeg" });

  const transcription = await getGroq().audio.transcriptions.create({
    model: "whisper-large-v3-turbo",
    file,
    // 不傳 language → whisper 自動偵測（寫死 zh 會把英文節目標成 Chinese 且段間黏字）
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  return toTranscriptionResult(transcription as unknown as GroqVerboseResult);
}

interface GroqVerboseResult {
  text?: unknown;
  language?: unknown;
  segments?: unknown;
}

/** Groq verbose_json → 統一結果：segment 去頭尾空白、語言轉 ISO 碼、全文以分段智慧串接 */
export function toTranscriptionResult(raw: GroqVerboseResult): TranscriptionResult {
  const rawSegments = Array.isArray(raw.segments) ? raw.segments : [];
  const segments: TranscriptSegment[] = [];
  for (const item of rawSegments) {
    if (!item || typeof item !== "object") continue;
    const s = item as { start?: unknown; end?: unknown; text?: unknown };
    if (typeof s.start !== "number" || typeof s.end !== "number" || typeof s.text !== "string") {
      continue;
    }
    const text = s.text.trim();
    if (text) segments.push({ start: s.start, end: s.end, text });
  }

  const fullText = segments.length
    ? joinSegmentTexts(segments.map((s) => s.text))
    : typeof raw.text === "string"
      ? raw.text.trim()
      : "";

  return {
    fullText,
    segments,
    language: normalizeLanguageCode(raw.language),
  };
}
