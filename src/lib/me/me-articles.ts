/**
 * 我的 · 發表過的感受（UX-04）：只列「已發佈」的文章（有 published_at 與 share_slug），計數也只算這些；
 * 未發佈的草稿另計（到編輯檯看），不再連到舊的內容編輯器。
 * 分類由綁定作品的類型推（UX-18），沒綁作品不顯示分類。
 */

import { parseArticle, extractWorkTitle, formatIssueMonth } from "@/lib/share/article";
import type { WorkKind } from "@/lib/works/format";

export interface MeEpisodeRow {
  id: string;
  title: string;
  source: string;
  created_at: string;
  share_slug: string | null;
  published_at: string | null;
  blogBody: string | null;
  work: { kind: WorkKind; title: string } | null;
}

export interface MeArticle {
  id: string;
  title: string;
  href: string;
  /** 發佈時間 */
  date: string;
  categoryLabel: string | null;
  /** 影劇用燒橙強調（沿用目錄慣例） */
  screen: boolean;
  workTitle: string | null;
}

export interface MeStats {
  sinceMonth: string | null;
  publishedCount: number;
  mostWritten: string;
}

const CATEGORY_OF_KIND: Record<WorkKind, string> = {
  movie: "影劇",
  series: "影劇",
  podcast_episode: "PODCAST",
  live: "場外",
  exhibition: "場外",
  music: "音樂",
};

type PublishedRow = MeEpisodeRow & { share_slug: string; published_at: string; blogBody: string };

function isPublished(row: MeEpisodeRow): row is PublishedRow {
  return row.source !== "rss" && Boolean(row.published_at && row.share_slug && row.blogBody);
}

function toArticle(row: PublishedRow): MeArticle {
  const title = parseArticle(row.blogBody).title ?? row.title;
  const categoryLabel = row.work ? CATEGORY_OF_KIND[row.work.kind] : null;
  return {
    id: row.id,
    title,
    href: `/s/${row.share_slug}`,
    date: row.published_at,
    categoryLabel,
    screen: categoryLabel === "影劇",
    workTitle: row.work?.title ?? extractWorkTitle(title, row.title, row.blogBody) ?? null,
  };
}

function mostWrittenOf(articles: readonly MeArticle[]): string {
  const counts = articles.reduce<Record<string, number>>(
    (acc, article) => (article.categoryLabel ? { ...acc, [article.categoryLabel]: (acc[article.categoryLabel] ?? 0) + 1 } : acc),
    {},
  );
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

export function buildMeArticles(rows: readonly MeEpisodeRow[]): {
  published: MeArticle[];
  draftCount: number;
  stats: MeStats;
} {
  const own = rows.filter((row) => row.source !== "rss");
  const published = own
    .filter(isPublished)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .map(toArticle);
  const earliest = published.map((article) => article.date).sort((a, b) => a.localeCompare(b))[0];
  return {
    published,
    draftCount: own.length - published.length,
    stats: {
      sinceMonth: earliest ? formatIssueMonth(earliest) : null,
      publishedCount: published.length,
      mostWritten: mostWrittenOf(published),
    },
  };
}
