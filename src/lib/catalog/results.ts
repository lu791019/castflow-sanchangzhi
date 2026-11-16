/**
 * 索引搜尋結果（Token「index.result」）：作品列海報、作者列印章、文章列明體標題＋印章署名。
 * 只用呼叫端給的公開資料組裝；每組依最近時間排序，不排名。
 */

import { authorPath } from "@/lib/authors/path";
import { withColumnName } from "@/lib/me/column-name";
import { buildAuthorRows } from "./authors";
import { columnName, type ColumnKey } from "./columns";
import { dotDate, taipeiWeekStart } from "./numbers";
import { highlight, includesQuery, snippetAround, type HighlightPart } from "./search";
import { shelfOfKind, type CatalogWork } from "./shelves";

/** 以筆名署名、公開發佈的文章（作者列表、欄目、搜尋都只用這種） */
export interface SignedArticle {
  id: string;
  userId: string;
  penName: string;
  workId: string | null;
  workKind: string | null;
  publishedAt: string;
  shareSlug: string;
}

export interface PublicFeeling {
  workId: string;
  userId: string;
  publishedAt: string;
}

export interface ArticleHit {
  article: SignedArticle;
  title: string;
  body: string;
  column?: ColumnKey;
}

export interface WorkResult {
  key: string;
  href: string;
  eyebrow: string;
  titleParts: HighlightPart[];
  meta: string;
  /** 封面補齊：作品類型與字卡上的直排名（Podcast 用節目名）；有圖放圖，沒圖走字卡 */
  coverKind: string;
  coverTitle: string;
  posterUrl: string | null;
}

export interface AuthorResult {
  penName: string;
  href: string;
  titleParts: HighlightPart[];
  meta: string;
}

export interface ArticleResult {
  key: string;
  href: string;
  eyebrow: string;
  titleParts: HighlightPart[];
  snippetParts: HighlightPart[] | null;
  penName: string;
  date: string;
}

export interface SearchResults {
  works: WorkResult[];
  authors: AuthorResult[];
  articles: ArticleResult[];
}

const RESULT_LIMIT = 20;

const SHELF_LABELS: Record<string, string> = {
  movie: "電影",
  series: "影集",
  podcast: "Podcast",
  music: "音樂",
  performance: "演出",
  exhibition: "展覽",
};

function workEyebrow(work: CatalogWork): string {
  const shelf = shelfOfKind(work.kind);
  const label = shelf ? SHELF_LABELS[shelf] : "作品";
  const detail =
    shelf === "podcast"
      ? work.podcastShow
      : shelf === "performance" || shelf === "exhibition"
        ? work.eventDate?.slice(5).replace("-", ".")
        : work.year;
  return ["作品", label, detail].filter(Boolean).join("・");
}

function workResults(
  query: string,
  works: ReadonlyArray<CatalogWork>,
  feelings: ReadonlyArray<PublicFeeling>,
  weekStart: string,
): WorkResult[] {
  return works
    .filter((work) => includesQuery(work.title, query) || includesQuery(work.podcastShow ?? "", query))
    .flatMap((work) => {
      const own = feelings.filter((feeling) => feeling.workId === work.id);
      if (own.length === 0) return [];
      const latestAt = own.reduce((latest, feeling) => (feeling.publishedAt > latest ? feeling.publishedAt : latest), "");
      const weekPeople = new Set(own.filter((feeling) => feeling.publishedAt >= weekStart).map((feeling) => feeling.userId)).size;
      const result: WorkResult = {
        key: work.id,
        href: `/works/${work.slug}`,
        eyebrow: workEyebrow(work),
        titleParts: highlight(work.title, query),
        meta: weekPeople > 0 ? `${own.length} 段感受・本週 ${weekPeople} 人說過` : `${own.length} 段感受`,
        coverKind: work.kind,
        coverTitle: work.podcastShow ?? work.title,
        posterUrl: work.posterUrl,
      };
      return [{ result, latestAt }];
    })
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
    .slice(0, RESULT_LIMIT)
    .map(({ result }) => result);
}

function articleResults(query: string, hits: ReadonlyArray<ArticleHit>): ArticleResult[] {
  return hits
    .flatMap((hit) => {
      const snippet = snippetAround(hit.body, query);
      if (!includesQuery(hit.title, query) && !snippet) return [];
      const result: ArticleResult = {
        key: hit.article.id,
        href: `/s/${hit.article.shareSlug}`,
        eyebrow: `文章・${columnName(hit.column ?? "essay")}`,
        titleParts: highlight(hit.title, query),
        snippetParts: snippet ? highlight(snippet, query) : null,
        penName: hit.article.penName,
        date: dotDate(hit.article.publishedAt),
      };
      return [{ result, publishedAt: hit.article.publishedAt }];
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, RESULT_LIMIT)
    .map(({ result }) => result);
}

export function buildSearchResults({
  query,
  works,
  feelings,
  signed,
  articleHits,
  now,
  columnNames,
}: {
  query: string;
  works: ReadonlyArray<CatalogWork>;
  feelings: ReadonlyArray<PublicFeeling>;
  signed: ReadonlyArray<SignedArticle>;
  articleHits: ReadonlyArray<ArticleHit>;
  now: Date;
  /** 筆名 → 專欄名（作者列副標前綴；設計稿「公車上的散場・十二篇」） */
  columnNames?: ReadonlyMap<string, string>;
}): SearchResults {
  if (!query) return { works: [], authors: [], articles: [] };
  const authors = buildAuthorRows(signed, columnNames)
    .filter((row) => includesQuery(row.penName, query))
    .slice(0, RESULT_LIMIT)
    .map((row) => ({
      penName: row.penName,
      href: authorPath(row.penName),
      titleParts: highlight(row.penName, query),
      meta: withColumnName(row.columnName, row.meta),
    }));
  return {
    works: workResults(query, works, feelings, taipeiWeekStart(now).toISOString()),
    authors,
    articles: articleResults(query, articleHits),
  };
}
