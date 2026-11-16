import type { MetadataRoute } from "next";
import { communityEnabled } from "@/lib/features";
import { listPublicArticles, listWorksAndAuthors, type SitemapEntry } from "@/lib/seo/sitemap-data";
import { siteOriginString } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

function toRoute(origin: string, entry: SitemapEntry, priority: number): MetadataRoute.Sitemap[number] {
  return {
    url: `${origin}${entry.path}`,
    ...(entry.lastModified ? { lastModified: new Date(entry.lastModified) } : {}),
    priority,
  };
}

/** 任一段讀不到就略過那段（不讓整張 sitemap 變 500），錯誤寫 log */
async function safely(label: string, load: () => Promise<SitemapEntry[]>): Promise<SitemapEntry[]> {
  try {
    return await load();
  } catch (error) {
    console.error(`[sitemap] ${label} 讀取失敗`, error instanceof Error ? error.message : error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOriginString();
  const community = communityEnabled();
  const [articles, catalog] = await Promise.all([
    safely("文章", listPublicArticles),
    safely("作品與作者", async () => {
      const { works, authors } = await listWorksAndAuthors();
      return [...works.map((w) => ({ ...w, path: w.path })), ...(community ? authors : [])];
    }),
  ]);
  const statics: SitemapEntry[] = [{ path: "/", lastModified: null }, { path: "/works", lastModified: null }, ...(community ? [{ path: "/catalog", lastModified: null }] : [])];
  return [
    ...statics.map((entry) => toRoute(origin, entry, 0.6)),
    ...articles.map((entry) => toRoute(origin, entry, 0.8)),
    ...catalog.map((entry) => toRoute(origin, entry, 0.5)),
  ];
}
