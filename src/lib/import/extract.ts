/**
 * 正文抽取（純函式，不碰網路）：@mozilla/readability（Firefox 閱讀模式引擎）跑在 linkedom 的 DOM 上，
 * 去掉導覽、廣告、留言、側欄，抽出標題、正文段落、原文發佈日期、首圖。
 * 抽不到像樣的正文一律回明確錯誤，不靜默塞空文章。
 */

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { ArticleBlock } from "@/lib/share/article";
import { articleMarkdown, blocksTextLength, htmlToBlocks } from "./blocks";

export { articleMarkdown };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ExtractedArticle {
  title: string;
  blocks: ArticleBlock[];
  /** 原文發佈時間（ISO）；抽不到或不合理為 null */
  publishedAt: string | null;
  /** 首圖（https 絕對網址）；沒有為 null */
  imageUrl: string | null;
}

export const NO_ARTICLE_ERROR = "這個網址抓不到正文，請貼單篇文章的網址";
export const MIN_BODY_CHARS = 80;
export const MAX_BODY_CHARS = 100_000;
export const MAX_TITLE_CHARS = 200;
const EARLIEST_YEAR = 1995;
const FUTURE_TOLERANCE_MS = 24 * 60 * 60_000;

type Doc = ReturnType<typeof parseHTML>["document"];

function metaContent(document: Doc, selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content")?.trim();
    if (value) return value;
  }
  return null;
}

function jsonLdField(document: Doc, field: "datePublished" | "image"): string | null {
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(script.textContent ?? "") as unknown;
      const nodes = (Array.isArray(data) ? data : [data]) as Array<Record<string, unknown>>;
      for (const node of nodes.flatMap((item) => (Array.isArray(item?.["@graph"]) ? (item["@graph"] as Array<Record<string, unknown>>) : [item]))) {
        const value = node?.[field];
        if (typeof value === "string") return value;
        if (Array.isArray(value) && typeof value[0] === "string") return value[0];
        if (value && typeof value === "object" && typeof (value as { url?: unknown }).url === "string") return (value as { url: string }).url;
      }
    } catch {
      // 壞掉的 JSON-LD 很常見，略過找下一個
    }
  }
  return null;
}

interface PageMeta {
  siteName: string | null;
  image: string | null;
  date: string | null;
}

/** Readability 會改動 DOM，中繼資料要先讀 */
function readMeta(document: Doc): PageMeta {
  return {
    siteName: metaContent(document, ['meta[property="og:site_name"]', 'meta[name="application-name"]']),
    image:
      metaContent(document, ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[property="twitter:image"]']) ??
      jsonLdField(document, "image"),
    date:
      metaContent(document, [
        'meta[property="article:published_time"]',
        'meta[property="og:published_time"]',
        'meta[itemprop="datePublished"]',
        'meta[name="date"]',
      ]) ??
      jsonLdField(document, "datePublished") ??
      document.querySelector("time[datetime]")?.getAttribute("datetime") ??
      null,
  };
}

export function normalizePublishedAt(value: string | null | undefined, now: Date): string | null {
  if (!value) return null;
  const time = Date.parse(value.trim());
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  if (date.getUTCFullYear() < EARLIEST_YEAR) return null;
  if (time > now.getTime() + FUTURE_TOLERANCE_MS) return null;
  return date.toISOString();
}

function absoluteHttps(value: string | null, pageUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), pageUrl);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function comparable(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 「標題 ｜ 站名」去掉站名 */
function cleanTitle(raw: string, siteName: string | null): string {
  const title = raw.replace(/\s+/g, " ").trim();
  if (!siteName) return title;
  const match = title.match(/^(.+?)\s*[|｜–—-]\s*(.+)$/);
  return match && comparable(match[2]) === comparable(siteName) ? match[1].trim() : title;
}

/** 正文開頭若是同一個標題就拿掉（文章頁另外顯示標題） */
function dropLeadingTitle(blocks: ArticleBlock[], title: string): ArticleBlock[] {
  const [first, ...rest] = blocks;
  return first && first.type !== "list" && comparable(first.text) === comparable(title) ? rest : blocks;
}

function firstHeading(blocks: readonly ArticleBlock[]): string | null {
  const first = blocks[0];
  return first?.type === "heading" ? first.text : null;
}

export function extractArticle(html: string, pageUrl: string, now: Date): Result<ExtractedArticle> {
  if (!html.trim()) return { ok: false, error: NO_ARTICLE_ERROR };
  const { document } = parseHTML(html);
  const meta = readMeta(document);
  const parsed = new Readability(document as unknown as Document, { charThreshold: MIN_BODY_CHARS }).parse();
  if (!parsed?.content) return { ok: false, error: NO_ARTICLE_ERROR };

  const rawBlocks = htmlToBlocks(parsed.content);
  const title = cleanTitle(parsed.title || firstHeading(rawBlocks) || "", meta.siteName ?? parsed.siteName ?? null);
  const blocks = dropLeadingTitle(rawBlocks, title);
  const length = blocksTextLength(blocks);
  if (!title || length < MIN_BODY_CHARS || !blocks.some((block) => block.type === "paragraph")) {
    return { ok: false, error: NO_ARTICLE_ERROR };
  }
  if (length > MAX_BODY_CHARS) return { ok: false, error: "這篇太長了（超過 10 萬字），先搬不進來" };

  return {
    ok: true,
    value: {
      title: Array.from(title).slice(0, MAX_TITLE_CHARS).join(""),
      blocks,
      publishedAt: normalizePublishedAt(parsed.publishedTime ?? meta.date, now),
      imageUrl: absoluteHttps(meta.image, pageUrl),
    },
  };
}
