/**
 * 索引頁的資料組裝（server only）：把公開資料整理成各分頁要的形狀。
 * 純推導都在 shelves／authors／columns／results／covers，這裡只負責「要讀哪些正文」。
 */

import { extractPullQuote, parseArticle } from "@/lib/share/article";
import { formatIssueLatin, formatIssueNo } from "@/lib/works/format";
import { buildAuthorRows } from "./authors";
import { columnName, type ColumnKey } from "./columns";
import { columnCounts, heroLine, latestOf, shortLine } from "./covers";
import { dotDate } from "./numbers";
import { loadArticleTexts, searchArticleIds, type ArticleText, type CatalogData } from "./repository";
import { buildSearchResults, type SearchResults, type SignedArticle } from "./results";
import { buildShelves } from "./shelves";
import type { ArticleRowItem, ColumnCoverData } from "./types";

const COLUMN_LIST_LIMIT = 50;
const TRY_COUNT = 3;

export interface CatalogHero {
  lines: [string, string];
  meta: string;
}

function maxIssueNo(data: CatalogData): number {
  return data.works.reduce((max, work) => Math.max(max, work.issueNo), 0);
}

export function catalogHero(data: CatalogData): CatalogHero {
  const workIds = new Set(data.feelings.map((feeling) => feeling.workId));
  const people = new Set(data.feelings.map((feeling) => feeling.userId)).size;
  const latest = latestOf(data.feelings);
  const issue = maxIssueNo(data);
  const meta = latest ? `收錄至 ${dotDate(latest.publishedAt)}${issue ? `・${formatIssueNo(issue)}` : ""}` : "";
  return { lines: heroLine(workIds.size, people), meta };
}

export function catalogShelves(data: CatalogData, expandedKind: string | null) {
  const all = buildShelves(data.works, data.feelings, { perShelf: Number.MAX_SAFE_INTEGER });
  const capped = buildShelves(data.works, data.feelings);
  return capped.map((shelf) => (shelf.kind === expandedKind ? all.find((full) => full.kind === shelf.kind) ?? shelf : shelf));
}

export function catalogAuthors(data: CatalogData) {
  return buildAuthorRows(data.signed, data.columnNames);
}

function quoteOf(text: ArticleText | undefined): string | null {
  if (!text) return null;
  return text.pullQuote ?? extractPullQuote(parseArticle(text.body).blocks);
}

function latestInColumn(data: CatalogData, key: ColumnKey): SignedArticle | null {
  return latestOf(data.signed.filter((article) => data.columns.get(article.id) === key));
}

export async function catalogColumnCovers(data: CatalogData): Promise<ColumnCoverData> {
  const essay = latestInColumn(data, "essay");
  const oneLine = latestInColumn(data, "one_line");
  const onsite = latestInColumn(data, "onsite");
  const texts = await loadArticleTexts([essay, oneLine].flatMap((article) => (article ? [article.id] : [])));
  const workById = new Map(data.works.map((work) => [work.id, work]));
  const essayQuote = essay ? quoteOf(texts.get(essay.id)) : null;
  const onsiteWork = onsite?.workId ? workById.get(onsite.workId) : undefined;
  return {
    counts: columnCounts(data.columns),
    issueLabel: `VOL.${formatIssueLatin(maxIssueNo(data))}`,
    essayQuote:
      essay && essayQuote
        ? { quote: essayQuote, penName: essay.penName, workTitle: essay.workId ? (workById.get(essay.workId)?.title ?? null) : null }
        : null,
    oneLine: oneLine ? shortLine(quoteOf(texts.get(oneLine.id))) : null,
    onsite: onsite && onsiteWork
      ? { title: onsiteWork.title, date: onsiteWork.eventDate ? onsiteWork.eventDate.slice(5).replace("-", ".") : dotDate(onsite.publishedAt) }
      : null,
  };
}

/** 文章列：只讀要顯示的那幾篇正文 */
export async function articleRows(data: Pick<CatalogData, "works" | "columns">, articles: SignedArticle[]): Promise<ArticleRowItem[]> {
  const shown = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, COLUMN_LIST_LIMIT);
  const texts = await loadArticleTexts(shown.map((article) => article.id));
  const workById = new Map(data.works.map((work) => [work.id, work]));
  return shown.flatMap((article) => {
    const text = texts.get(article.id);
    if (!text) return [];
    return [
      {
        key: article.id,
        href: `/s/${article.shareSlug}`,
        date: dotDate(article.publishedAt),
        title: text.title,
        columnName: columnName(data.columns.get(article.id) ?? "essay"),
        workTitle: article.workId ? (workById.get(article.workId)?.title ?? null) : null,
        penName: article.penName,
      },
    ];
  });
}

export function columnArticles(data: CatalogData, key: ColumnKey): SignedArticle[] {
  return data.signed.filter((article) => data.columns.get(article.id) === key);
}

export async function catalogSearch(data: CatalogData, query: string, now: Date): Promise<SearchResults> {
  const signedById = new Map(data.signed.map((article) => [article.id, article]));
  const hitIds = (await searchArticleIds(query)).filter((id) => signedById.has(id));
  const texts = await loadArticleTexts(hitIds);
  const articleHits = hitIds.flatMap((id) => {
    const text = texts.get(id);
    const article = signedById.get(id);
    return text && article ? [{ article, title: text.title, body: text.body, column: data.columns.get(id) }] : [];
  });
  return buildSearchResults({
    query,
    works: data.works,
    feelings: data.feelings,
    signed: data.signed,
    articleHits,
    now,
    columnNames: data.columnNames,
  });
}

/** 無結果時的「試試」：最近被說起的作品與作者 */
export function catalogTries(data: CatalogData, query: string): string[] {
  const shelves = buildShelves(data.works, data.feelings, { perShelf: TRY_COUNT });
  const works = shelves.flatMap((shelf) => shelf.items).sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  const author = buildAuthorRows(data.signed)[0]?.penName;
  const candidates = [works[0]?.title, author, works[1]?.title].filter((term): term is string => Boolean(term) && term !== query);
  return [...new Set(candidates)].slice(0, TRY_COUNT);
}
