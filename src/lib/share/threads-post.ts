/**
 * Threads 貼文文字模板（設計稿 P2「Threads 貼文模板」）：分享時一鍵帶入的內文，不是 AI 生成的貼文。
 * 結構：「引言」／一句話／文章連結／#作品名（選填），段落之間空一行。
 * 標題、期號、署名都在 OG 預覽卡上，內文不再寫。
 * 公開與「只給有連結的人」都產生；私人不產生。
 * 太長時：先縮「一句話」，再截引言到第一個逗號＋「……」；連結永遠保留。
 * （這是確定性的模板規則，不是 LLM 輸出，所以可以截；LLM 輸出一律重試不截斷。）
 */

import type { Visibility } from "@/lib/proof/publish";
import { isShareable } from "@/lib/proof/publish";
import type { Work } from "@/lib/works/format";

/** Threads 上限 500 字；設計稿要求實際控制在 120 字內（含標點與換行） */
export const THREADS_MAX_CHARS = 500;
export const THREADS_TARGET_CHARS = 120;
export const QUOTE_MAX_CHARS = 40;
export const ONE_LINER_MAX_CHARS = 40;

const PARAGRAPH_GAP = "\n\n";
const ELLIPSIS = "……";
const SENTENCE_END = /[。！？]/;
const CLAUSE_SPLIT = /(?<=[，、；])/;

function charCount(text: string): number {
  return Array.from(text).length;
}

function sliceChars(text: string, length: number): string {
  return Array.from(text).slice(0, length).join("");
}

function stripQuoteMarks(text: string): string {
  return text.trim().replace(/^[「『"“]+|[」』"”]+$/g, "").trim();
}

/** 第一個句號（含）以前；沒有句號回原文 */
function firstSentence(text: string): string {
  const match = SENTENCE_END.exec(text);
  return match ? text.slice(0, match.index + 1) : text;
}

/** 依子句累加到 max 字內；第一個子句就超過回 null。句尾的逗號換成句號 */
function clausesWithin(text: string, max: number): string | null {
  let result = "";
  for (const clause of text.split(CLAUSE_SPLIT)) {
    if (charCount(result + clause) > max) break;
    result += clause;
  }
  if (!result) return null;
  return result.replace(/[，、；]$/, "。");
}

/** 引言：原句照搬；超過 40 字取第一個句號前，仍太長截到逗號＋「……」 */
export function shortQuote(raw: string | null | undefined): string | null {
  const quote = stripQuoteMarks(raw ?? "");
  if (!quote) return null;
  if (charCount(quote) <= QUOTE_MAX_CHARS) return quote;
  const sentence = firstSentence(quote);
  if (charCount(sentence) <= QUOTE_MAX_CHARS) return sentence;
  const clauses = clausesWithin(sentence, QUOTE_MAX_CHARS - charCount(ELLIPSIS));
  const head = clauses ? clauses.replace(/。$/, "") : sliceChars(sentence, QUOTE_MAX_CHARS - 2);
  return `${head}${ELLIPSIS}`;
}

/** 一句話：max 字內原樣；太長以子句為單位縮短（不硬切半句），第一個子句就超過回 null */
export function shortOneLiner(raw: string | null | undefined, max = ONE_LINER_MAX_CHARS): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (charCount(text) <= max) return text;
  const sentence = firstSentence(text);
  if (charCount(sentence) <= max) return sentence;
  return clausesWithin(sentence, max);
}

/** 主題標籤只收一個：Podcast 用節目名，其他用作品名；沒綁作品時用標題裡的《作品》 */
export function threadsTag(
  work: Pick<Work, "kind" | "title" | "podcast_show"> | null,
  fallbackTitle: string | null,
): string | null {
  const name =
    (work?.kind === "podcast_episode" ? work.podcast_show : work?.title) ?? fallbackTitle ?? "";
  const cleaned = name.replace(/[#\s]/g, "");
  return cleaned ? `#${cleaned}` : null;
}

/** 引言截到第一個逗號＋「……」（太長時的第二步） */
function quoteToFirstComma(quote: string): string {
  const head = quote.split(/[，、；。！？]/)[0];
  return head && head !== quote ? `${head}${ELLIPSIS}` : quote;
}

export interface ThreadsPostInput {
  quote: string | null;
  oneLiner: string | null;
  url: string;
  tag: string | null;
  visibility: Visibility;
}

interface Parts {
  quote: string | null;
  oneLiner: string | null;
  tag: string | null;
}

function join(parts: Parts, url: string): string {
  return [parts.quote ? `「${parts.quote}」` : null, parts.oneLiner, url, parts.tag]
    .filter((part): part is string => Boolean(part))
    .join(PARAGRAPH_GAP);
}

function firstClause(text: string): string {
  return text.split(CLAUSE_SPLIT)[0] ?? text;
}

/** 依設計稿「太長時」規則逐步縮短；每一步都保留連結 */
function fit(parts: Parts, url: string): string {
  const fits = (candidate: Parts) => charCount(join(candidate, url)) <= THREADS_TARGET_CHARS;
  if (fits(parts)) return join(parts, url);

  // 一、縮一句話：縮到剛好放得下，但至少保留第一個子句
  const others = charCount(join({ ...parts, oneLiner: null }, url)) + PARAGRAPH_GAP.length;
  const budget = Math.max(THREADS_TARGET_CHARS - others, charCount(firstClause(parts.oneLiner ?? "")));
  const shrunk: Parts = { ...parts, oneLiner: shortOneLiner(parts.oneLiner, budget) };
  if (fits(shrunk)) return join(shrunk, url);

  // 二、引言截到第一個逗號＋「……」
  const cut: Parts = { ...shrunk, quote: shrunk.quote ? quoteToFirstComma(shrunk.quote) : null };
  if (fits(cut)) return join(cut, url);

  // 三、仍放不下（多半是網址很長）：依序拿掉一句話、標籤，連結永遠保留
  const withoutLiner: Parts = { ...cut, oneLiner: null };
  if (fits(withoutLiner)) return join(withoutLiner, url);
  const bare = join({ ...withoutLiner, tag: null }, url);
  return charCount(bare) <= THREADS_MAX_CHARS ? bare : url;
}

/** Threads 貼文內文；私人文章回 null（不產生） */
export function composeThreadsPost(input: ThreadsPostInput): string | null {
  if (!isShareable(input.visibility)) return null;
  const url = input.url.trim();
  if (!url) return null;
  const parts: Parts = {
    quote: shortQuote(input.quote),
    oneLiner: shortOneLiner(input.oneLiner),
    tag: input.tag?.trim() || null,
  };
  return fit(parts, url);
}

export interface ArticleThreadsInput {
  visibility: Visibility;
  /** 校樣選定的引言 */
  pullQuote: string | null;
  /** 文章副標（一句話的來源） */
  lede: string | null;
  work: Pick<Work, "kind" | "title" | "podcast_show"> | null;
  /** 沒綁作品時，標題裡的《作品》 */
  workTitle: string | null;
  shareUrl: string;
}

/** 校樣「分享到 Threads」用：由文章欄位組出模板內文；私人回 null */
export function threadsPostForArticle(input: ArticleThreadsInput): string | null {
  return composeThreadsPost({
    quote: input.pullQuote,
    oneLiner: input.lede,
    url: input.shareUrl,
    tag: threadsTag(input.work, input.workTitle),
    visibility: input.visibility,
  });
}

/** Threads 發文意圖網址（一鍵帶入內文） */
export function threadsIntentUrl(text: string): string {
  return `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`;
}
