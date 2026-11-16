/**
 * 共鳴的單位「段」（server only：雜湊用 node:crypto）。
 * 段＝分享頁正文的 paragraph block（AI 整理時切好的段，多半一段一句）；標題、清單、引言不算。
 * 識別＝文章 + 段落文字雜湊：作者改了某段的字，那段的舊記號對不上就不顯示；
 * 前後插段、換順序都不影響沒改到的段。
 */

import { createHash } from "node:crypto";
import type { ArticleBlock } from "@/lib/share/article";

export const PASSAGE_HASH_PATTERN = /^[0-9a-f]{16}$/;

export interface Passage {
  /** 在 blocks 陣列中的位置（渲染時對應用） */
  blockIndex: number;
  /** 第幾段（只算段落，0 起） */
  index: number;
  text: string;
  hash: string;
}

export function normalizePassageText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** 正規化後 SHA-256 前 16 碼 hex */
export function passageHash(text: string): string {
  return createHash("sha256").update(normalizePassageText(text), "utf8").digest("hex").slice(0, 16);
}

export function isPassageHash(value: unknown): value is string {
  return typeof value === "string" && PASSAGE_HASH_PATTERN.test(value);
}

export function listPassages(blocks: readonly ArticleBlock[]): Passage[] {
  const paragraphs = blocks.flatMap((block, blockIndex) =>
    block.type === "paragraph" ? [{ blockIndex, text: block.text }] : [],
  );
  return paragraphs.map(({ blockIndex, text }, index) => ({ blockIndex, index, text, hash: passageHash(text) }));
}
