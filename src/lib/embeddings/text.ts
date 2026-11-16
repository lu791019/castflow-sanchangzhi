/**
 * 送去算詞向量的文字（純函式）：標題＋作品名＋全文，去掉 Markdown 標記，截到 EMBEDDING_MAX_CHARS 字。
 * content_hash＝模型＋文字的 SHA-256；兩者都沒變就不重算。
 */

import { createHash } from "node:crypto";
import { parseArticle } from "@/lib/share/article";

export const EMBEDDING_MAX_CHARS = 6000;

export interface EmbeddingTextInput {
  /** episodes.title；正文開頭有 `# 標題` 時以正文為準（與分享頁一致） */
  title: string;
  workTitle: string | null;
  /** contents（blog）的 Markdown 正文 */
  body: string | null;
}

function bodyText(body: string | null): { title: string | null; text: string } {
  if (!body?.trim()) return { title: null, text: "" };
  const parsed = parseArticle(body);
  const text = parsed.blocks
    .map((block) => (block.type === "list" ? block.items.join("\n") : block.text))
    .join("\n");
  return { title: parsed.title, text };
}

export function buildEmbeddingText(input: EmbeddingTextInput): string {
  const parsed = bodyText(input.body);
  const title = (parsed.title ?? input.title).trim();
  const work = input.workTitle?.trim();
  const head = [title, work ? `《${work}》` : ""].filter(Boolean).join("\n");
  const text = [head, parsed.text.trim()].filter(Boolean).join("\n\n");
  return Array.from(text).slice(0, EMBEDDING_MAX_CHARS).join("");
}

export function contentHash(model: string, text: string): string {
  return createHash("sha256").update(model).update("\u0000").update(text).digest("hex");
}
