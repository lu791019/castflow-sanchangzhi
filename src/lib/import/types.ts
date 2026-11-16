/** 文章匯入：API、service、畫面共用的型別 */

import type { ArticleBlock } from "@/lib/share/article";
import type { WorkGuess } from "./guess";

export interface ImportPreview {
  /** 正規化後的原文網址（也是重複判斷的鍵） */
  url: string;
  domain: string;
  title: string;
  /** 正文預覽：前幾段 */
  excerpt: ArticleBlock[];
  /** 正文總字數 */
  charCount: number;
  publishedAt: string | null;
  imageUrl: string | null;
  /** LLM 判斷的作品；失敗為 null（已推警報，畫面改手動搜尋） */
  guess: WorkGuess | null;
}

export interface ImportedRef {
  title: string;
  href: string;
}

export type PreviewOutcome =
  | { status: "ready"; preview: ImportPreview }
  | { status: "duplicate"; existing: ImportedRef }
  | { status: "invalid"; error: string }
  | { status: "failed"; error: string };

export type CommitOutcome =
  | { status: "imported"; episodeId: string; article: ImportedRef }
  | { status: "duplicate"; existing: ImportedRef }
  | { status: "invalid"; error: string }
  | { status: "failed"; error: string };

export interface CommitInput {
  url: unknown;
  workId: unknown;
  confirmed: unknown;
}
