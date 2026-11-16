/** sitemap 資料（server only）：公開已發佈文章、作品頁、有公開署名文章的作者專欄 */

import { authorPath } from "@/lib/authors/path";
import { loadCatalogData } from "@/lib/catalog/repository";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SitemapEntry {
  path: string;
  lastModified: string | null;
}

export const SITEMAP_ARTICLE_LIMIT = 5000;

export async function listPublicArticles(): Promise<SitemapEntry[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("share_slug, published_at")
    .eq("visibility", "public")
    .not("share_slug", "is", null)
    .not("published_at", "is", null)
    .neq("source", "rss")
    .order("published_at", { ascending: false })
    .limit(SITEMAP_ARTICLE_LIMIT);
  if (error) throw new Error(`sitemap 讀取文章失敗：${error.message}`);
  return (data ?? []).map((row) => ({ path: `/s/${row.share_slug as string}`, lastModified: row.published_at as string }));
}

/** 作品頁與作者專欄：沿用索引頁的資料載入（只含有公開文章的作者） */
export async function listWorksAndAuthors(): Promise<{ works: SitemapEntry[]; authors: SitemapEntry[] }> {
  const data = await loadCatalogData();
  const lastByWork = new Map<string, string>();
  const lastByAuthor = new Map<string, string>();
  for (const article of data.signed) {
    if (article.workId) lastByWork.set(article.workId, laterOf(lastByWork.get(article.workId), article.publishedAt));
    lastByAuthor.set(article.penName, laterOf(lastByAuthor.get(article.penName), article.publishedAt));
  }
  return {
    works: data.works.map((work) => ({ path: `/works/${work.slug}`, lastModified: lastByWork.get(work.id) ?? null })),
    authors: [...lastByAuthor.entries()].map(([penName, at]) => ({ path: authorPath(penName), lastModified: at })),
  };
}

function laterOf(a: string | undefined, b: string): string {
  return a && a > b ? a : b;
}
