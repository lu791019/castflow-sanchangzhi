/**
 * 校樣文件模型：blog 正文 ↔ 可逐段編輯的結構。
 * - AI 原版 = contents.original_body；作者修改版 = contents.body
 * - 逐段比對判斷「已修改」，還原 = 換回 AI 原版同位置的文字
 * - 存檔時序列化回 Markdown（parseArticle 可原樣讀回）
 */

import {
  deriveLede,
  parseArticle,
  pullQuotePosition,
  type ArticleBlock,
} from "@/lib/share/article";

export interface ProofDoc {
  title: string;
  blocks: ArticleBlock[];
}

/** 可編輯的位置：標題或第 i 個 block（段落/小標） */
export type ProofTarget = { kind: "title" } | { kind: "block"; index: number };

export function toProofDoc(body: string, fallbackTitle: string): ProofDoc {
  const parsed = parseArticle(body);
  return { title: parsed.title ?? fallbackTitle, blocks: parsed.blocks };
}

/** 序列化回 Markdown：`# 標題` + 空行分段；小標 `##`、清單 `- ` */
export function serializeProofDoc(doc: ProofDoc): string {
  const parts = doc.blocks.map((block) => {
    if (block.type === "heading") return `## ${block.text}`;
    if (block.type === "list") return block.items.map((item) => `- ${item}`).join("\n");
    return block.text;
  });
  return [`# ${doc.title}`, ...parts].join("\n\n") + "\n";
}

/** 版面切分：首段夠短當副標（與分享頁一致），其餘為正文；回傳正文在 blocks 中的起始位置 */
export function splitLede(doc: ProofDoc): { ledeIndex: number | null; bodyStart: number } {
  const { lede } = deriveLede(doc.blocks);
  return lede === null ? { ledeIndex: null, bodyStart: 0 } : { ledeIndex: 0, bodyStart: 1 };
}

/** 引言插入點（以正文 block 計，與分享頁 pullQuotePosition 相同規則） */
export function proofQuoteAfter(doc: ProofDoc): number {
  const { bodyStart } = splitLede(doc);
  return pullQuotePosition(doc.blocks.slice(bodyStart));
}

function blockText(block: ArticleBlock | undefined): string | null {
  if (!block || block.type === "list") return null;
  return block.text;
}

export function targetText(doc: ProofDoc, target: ProofTarget): string | null {
  return target.kind === "title" ? doc.title : blockText(doc.blocks[target.index]);
}

/** AI 原版對應位置的文字；原版結構對不上（段數不同或型別不同）時回傳 null */
export function originalTextFor(
  original: ProofDoc,
  current: ProofDoc,
  target: ProofTarget,
): string | null {
  if (target.kind === "title") return original.title;
  if (original.blocks.length !== current.blocks.length) return null;
  const before = original.blocks[target.index];
  const now = current.blocks[target.index];
  if (!before || !now || before.type !== now.type) return null;
  return blockText(before);
}

export function isModified(original: ProofDoc, current: ProofDoc, target: ProofTarget): boolean {
  const before = originalTextFor(original, current, target);
  const now = targetText(current, target);
  return before !== null && now !== null && before.trim() !== now.trim();
}

/** 不可變更新：回傳換掉指定位置文字的新文件（清單不可編輯，原樣回傳） */
export function updateTarget(doc: ProofDoc, target: ProofTarget, text: string): ProofDoc {
  if (target.kind === "title") return { ...doc, title: text };
  const block = doc.blocks[target.index];
  if (!block || block.type === "list") return doc;
  const blocks = doc.blocks.map((item, index) =>
    index === target.index ? { ...block, text } : item,
  );
  return { ...doc, blocks };
}

export function revertTarget(original: ProofDoc, current: ProofDoc, target: ProofTarget): ProofDoc {
  const before = originalTextFor(original, current, target);
  return before === null ? current : updateTarget(current, target, before);
}

/** 「編輯第 n 段」：正文段落序號（不含副標、小標與清單） */
export function paragraphNumber(doc: ProofDoc, index: number): number {
  const { bodyStart } = splitLede(doc);
  return doc.blocks
    .slice(bodyStart, index + 1)
    .filter((block) => block.type === "paragraph").length;
}

/** 存檔前清理：空白段落移除、標題不可空 */
export function normalizeForSave(doc: ProofDoc, fallbackTitle: string): ProofDoc {
  const title = doc.title.replace(/\s+/g, " ").trim() || fallbackTitle;
  const blocks = doc.blocks.filter((block) =>
    block.type === "list" ? block.items.length > 0 : block.text.trim().length > 0,
  );
  return {
    title,
    blocks: blocks.map((block) =>
      block.type === "list" ? block : { ...block, text: block.text.replace(/\s*\n\s*/g, "").trim() },
    ),
  };
}

export const MAX_TITLE_CHARS = 200;
export const MAX_BLOCK_CHARS = 5000;
export const MAX_BLOCKS = 200;

function parseBlockInput(raw: unknown): ArticleBlock | null {
  if (typeof raw !== "object" || raw === null) return null;
  const block = raw as Record<string, unknown>;
  if (block.type === "paragraph" || block.type === "heading") {
    if (typeof block.text !== "string" || block.text.length > MAX_BLOCK_CHARS) return null;
    return { type: block.type, text: block.text };
  }
  if (block.type === "list" && Array.isArray(block.items)) {
    const items = block.items;
    const valid = items.every(
      (item) => typeof item === "string" && item.length <= MAX_BLOCK_CHARS,
    );
    return valid ? { type: "list", items: items as string[] } : null;
  }
  return null;
}

/** 驗證 client 送來的文件（系統邊界）：不合格回傳 null */
export function parseProofDocInput(input: unknown): ProofDoc | null {
  if (typeof input !== "object" || input === null) return null;
  const { title, blocks } = input as Record<string, unknown>;
  if (typeof title !== "string" || title.length > MAX_TITLE_CHARS) return null;
  if (!Array.isArray(blocks) || blocks.length > MAX_BLOCKS) return null;
  const parsed = blocks.map(parseBlockInput);
  if (parsed.some((block) => block === null)) return null;
  return { title, blocks: parsed as ArticleBlock[] };
}

/** 給引擎挑引言的純文字正文（標題除外） */
export function proofPlainText(doc: ProofDoc): string {
  return doc.blocks
    .map((block) => (block.type === "list" ? block.items.join("\n") : block.text))
    .join("\n\n");
}
