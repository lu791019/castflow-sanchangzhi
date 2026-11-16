export type EpisodeStatus = "uploading" | "uploaded" | "transcribing" | "transcribed" | "error";

export type ContentStatus = "draft" | "scheduled" | "published" | "failed";

export type PublishStatus = "pending" | "success" | "failed";

export type Platform = "threads" | "facebook" | "instagram" | "linkedin" | "blog" | "newsletter";

export type EpisodeSource = "audio" | "text" | "rss";

export interface Episode {
  id: string;
  title: string;
  audio_url: string | null;
  duration_seconds: number | null;
  status: EpisodeStatus;
  source: EpisodeSource;
  created_at: string;
  user_id: string;
}

export interface Transcript {
  id: string;
  episode_id: string;
  full_text: string;
  segments: TranscriptSegment[];
  language: string;
  created_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface StyleDna {
  id: string;
  name: string;
  platform: Platform;
  dimensions: StyleDimensions;
  source_example_count: number;
  extracted_at: string;
  user_id: string;
}

export interface StyleDimensions {
  structure_pattern: string;
  hook_pattern: string;
  tone_features: string;
  cta_pattern: string;
  format_specs: string;
  high_engagement_features: string;
  taboos: string;
  [key: string]: string;
}

export const REQUIRED_DIMENSION_KEYS = [
  "structure_pattern",
  "hook_pattern",
  "tone_features",
  "cta_pattern",
  "format_specs",
  "high_engagement_features",
  "taboos",
] as const;

export const DIMENSION_LABELS: Record<string, string> = {
  structure_pattern: "結構模式",
  hook_pattern: "開場 Hook 模式",
  tone_features: "語氣特徵",
  cta_pattern: "CTA / 收尾模式",
  format_specs: "長度 / 格式",
  high_engagement_features: "高互動特徵",
  taboos: "禁忌",
};

export interface Content {
  id: string;
  episode_id: string;
  style_dna_id: string | null;
  platform: Platform;
  body: string;
  original_body: string | null;
  media_urls: string[];
  status: ContentStatus;
  scheduled_at: string | null;
  published_at: string | null;
  user_id: string;
}

export interface PublishLog {
  id: string;
  content_id: string;
  platform: Platform;
  platform_post_id: string | null;
  response: Record<string, unknown> | null;
  status: PublishStatus;
  error_message: string | null;
  created_at: string;
}

// ── 引擎介面契約(Q-23/Q-24)──────────────────────────────
// 引擎吃「原始內容 + 設定」吐「結構化 JSON」,不知道產品語境、不 import app 碼

export type EngineSource =
  | { kind: "audio"; audioUrl: string }
  | { kind: "text"; text: string };

// ── 閱讀引擎（Phase 1e）：雙語對照 + 摘要 + 章節 ─────────────

/** 雙語對照的一段：原文 + 繁中譯文（原文本就是中文時 translated_text 為 null） */
export interface BilingualSegment {
  start: number;
  end: number;
  speaker?: string;
  source_text: string;
  source_lang: string;
  translated_text: string | null;
}

export interface Chapter {
  title: string;
  /** 章節起始秒數（對齊逐字稿時間戳） */
  start: number;
}

/** 一條重點摘要：繁中一句話 + 起始秒數（對齊逐字稿段落起點，閱讀頁可點跳轉） */
export interface SummaryPoint {
  text: string;
  start: number;
}

export interface ReadingResult {
  segments: BilingualSegment[];
  /** 3–5 條繁中重點摘要（附時間戳） */
  summary: SummaryPoint[];
  chapters: Chapter[];
  language: string;
}
