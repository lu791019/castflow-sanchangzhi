/**
 * 文章匯入流程（存取層與外部呼叫皆注入，測試用假 deps）：
 * - previewImport：網址正規化 → 已搬過？ → 抓網頁 → 抽正文 → LLM 判斷作品（失敗不擋、推警報）
 * - commitImport：必勾「這是我寫的」、必選作品 → server 重抓原文（不信任瀏覽器送來的正文）→ 寫入
 * 抓取失敗與 LLM 失敗都推 warn；抽不到正文回明確錯誤。
 */

import { proofPlainText, toProofDoc } from "@/lib/proof/document";
import { blocksTextLength } from "./blocks";
import { articleMarkdown, extractArticle, type ExtractedArticle } from "./extract";
import { NotHtmlError, type PageFetcher } from "./fetch-page";
import { guessLead, guessWork, type GuessLlm, type WorkGuess } from "./guess";
import type { CommitInput, CommitOutcome, ImportedRef, PreviewOutcome } from "./types";
import { displayDomain, normalizeArticleUrl } from "./url";

export const EXCERPT_BLOCKS = 4;
export const FETCH_FAILED_MESSAGE = "抓不到這篇文章，確認網址能公開瀏覽後再試一次";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DuplicateImportError extends Error {
  constructor() {
    super("同一篇原文已經搬過了");
    this.name = "DuplicateImportError";
  }
}

export interface ImportedEpisodeRow {
  title: string;
  shareSlug: string | null;
}

export interface NewImportedEpisode {
  userId: string;
  title: string;
  markdown: string;
  plainText: string;
  workId: string;
  originalUrl: string;
  publishedAt: string;
}

export interface ImportRepo {
  findImported(userId: string, originalUrl: string): Promise<ImportedEpisodeRow | null>;
  workExists(workId: string): Promise<boolean>;
  /** 同一使用者同一原文撞唯一索引時丟 DuplicateImportError */
  insertImported(row: NewImportedEpisode): Promise<{ episodeId: string; shareSlug: string }>;
}

export interface ImportDeps {
  repo: ImportRepo;
  fetchPage: PageFetcher;
  guessLlm: GuessLlm;
  warn: (title: string, detail: string) => Promise<void>;
  now: () => Date;
}

function articleHref(shareSlug: string | null): string {
  return shareSlug ? `/s/${shareSlug}` : "/me/desk?tab=published";
}

function toRef(row: ImportedEpisodeRow): ImportedRef {
  return { title: row.title, href: articleHref(row.shareSlug) };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Loaded = { ok: true; article: ExtractedArticle } | { ok: false; outcome: { status: "failed"; error: string } };

/** 抓網頁＋抽正文；抓取失敗推 warn */
async function loadArticle(deps: ImportDeps, url: string): Promise<Loaded> {
  let page;
  try {
    page = await deps.fetchPage(new URL(url));
  } catch (error) {
    if (error instanceof NotHtmlError) return { ok: false, outcome: { status: "failed", error: error.message } };
    console.error("[import] 抓取失敗", { url, message: message(error) });
    await deps.warn("文章匯入：抓取失敗", `${url}：${message(error)}`).catch(() => undefined);
    return { ok: false, outcome: { status: "failed", error: FETCH_FAILED_MESSAGE } };
  }
  const extracted = extractArticle(page.html, page.finalUrl, deps.now());
  if (!extracted.ok) {
    console.warn("[import] 抽不到正文", { url, error: extracted.error });
    return { ok: false, outcome: { status: "failed", error: extracted.error } };
  }
  return { ok: true, article: extracted.value };
}

async function safeGuess(deps: ImportDeps, url: string, article: ExtractedArticle): Promise<WorkGuess | null> {
  try {
    return await guessWork({ title: article.title, lead: guessLead(article.blocks) }, deps.guessLlm);
  } catch (error) {
    console.error("[import] 判斷作品失敗", { url, message: message(error) });
    await deps.warn("文章匯入：判斷作品失敗（改手動選）", `${url}：${message(error)}`).catch(() => undefined);
    return null;
  }
}

export async function previewImport(deps: ImportDeps, userId: string, rawUrl: unknown): Promise<PreviewOutcome> {
  const normalized = normalizeArticleUrl(typeof rawUrl === "string" ? rawUrl : "");
  if (!normalized.ok) return { status: "invalid", error: normalized.error };
  const url = normalized.value;

  const existing = await deps.repo.findImported(userId, url);
  if (existing) return { status: "duplicate", existing: toRef(existing) };

  const loaded = await loadArticle(deps, url);
  if (!loaded.ok) return loaded.outcome;
  const { article } = loaded;
  const guess = await safeGuess(deps, url, article);
  return {
    status: "ready",
    preview: {
      url,
      domain: displayDomain(url) ?? url,
      title: article.title,
      excerpt: article.blocks.slice(0, EXCERPT_BLOCKS),
      charCount: blocksTextLength(article.blocks),
      publishedAt: article.publishedAt,
      imageUrl: article.imageUrl,
      guess,
    },
  };
}

async function duplicateOutcome(deps: ImportDeps, userId: string, url: string): Promise<CommitOutcome> {
  const existing = await deps.repo.findImported(userId, url);
  return { status: "duplicate", existing: existing ? toRef(existing) : { title: "", href: articleHref(null) } };
}

export async function commitImport(deps: ImportDeps, userId: string, input: CommitInput): Promise<CommitOutcome> {
  if (input.confirmed !== true) return { status: "invalid", error: "請勾選「這是我寫的文章」" };
  const normalized = normalizeArticleUrl(typeof input.url === "string" ? input.url : "");
  if (!normalized.ok) return { status: "invalid", error: normalized.error };
  const url = normalized.value;
  if (typeof input.workId !== "string" || !UUID_PATTERN.test(input.workId)) return { status: "invalid", error: "請先選定作品" };
  const workId = input.workId;
  if (!(await deps.repo.workExists(workId))) return { status: "invalid", error: "找不到這部作品" };

  const existing = await deps.repo.findImported(userId, url);
  if (existing) return { status: "duplicate", existing: toRef(existing) };

  const loaded = await loadArticle(deps, url);
  if (!loaded.ok) return loaded.outcome;
  const { article } = loaded;
  const markdown = articleMarkdown(article.title, article.blocks);
  try {
    const saved = await deps.repo.insertImported({
      userId,
      title: article.title,
      markdown,
      plainText: proofPlainText(toProofDoc(markdown, article.title)),
      workId,
      originalUrl: url,
      publishedAt: article.publishedAt ?? deps.now().toISOString(),
    });
    return { status: "imported", episodeId: saved.episodeId, article: { title: article.title, href: articleHref(saved.shareSlug) } };
  } catch (error) {
    if (error instanceof DuplicateImportError) return duplicateOutcome(deps, userId, url);
    throw error;
  }
}
