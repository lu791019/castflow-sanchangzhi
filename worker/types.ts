/**
 * worker 對外契約型別。worker 只透過 HTTP API 與 DB（service key）互動，
 * 不 import app 碼——這層未來可整層替換為雲端函式（Q-02）。
 * 欄位語意與 packages/engine types 對齊，但刻意不建立 import 依賴。
 */

export type EpisodeStatus =
  | "uploading"
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "error";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptSegment[];
  language: string;
}

export interface QueuedEpisode {
  id: string;
  title: string;
  audio_url: string;
}
