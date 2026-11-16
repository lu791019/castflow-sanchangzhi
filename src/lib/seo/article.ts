/**
 * 文章頁 SEO（純函式）：<title> 公式與 JSON-LD。
 * 標題帶作品名與「心得」字樣（搜「某片 心得／好看嗎」才找得到）；H1 不變，只改 <title>。
 */

import type { WorkKind } from "@/lib/works/format";
import { SITE_TITLE } from "./site";

export interface SeoTitleInput {
  title: string;
  workTitle: string | null;
}

/** 《作品》心得・文章標題｜散場誌；文章標題已含作品名就不重複 */
export function articleSeoTitle({ title, workTitle }: SeoTitleInput): string {
  const clean = title.trim();
  if (!workTitle || clean.includes(workTitle)) return `${clean}｜${SITE_TITLE}`;
  return `《${workTitle}》心得・${clean}｜${SITE_TITLE}`;
}

export function workSeoTitle(workTitle: string, kind: WorkKind | string | null): string {
  const noun =
    kind === "podcast_episode" || kind === "music" ? "聽後感" : kind === "live" || kind === "exhibition" ? "觀後感" : "心得與評價";
  return `《${workTitle}》${noun}｜${SITE_TITLE}`;
}

export interface ArticleJsonLdInput {
  origin: string;
  slug: string;
  headline: string;
  description: string | null;
  authorName: string;
  authorPath: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  work: { kind: WorkKind | string; title: string; year: number | null } | null;
}

const ABOUT_TYPES: Record<string, string> = {
  movie: "Movie",
  series: "TVSeries",
  podcast_episode: "PodcastEpisode",
  live: "Event",
  exhibition: "ExhibitionEvent",
  music: "MusicAlbum",
};

export function articleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  const url = `${input.origin}/s/${input.slug}`;
  const author: Record<string, unknown> = { "@type": "Person", name: input.authorName };
  if (input.authorPath) author.url = `${input.origin}${input.authorPath}`;
  const about = input.work
    ? {
        "@type": ABOUT_TYPES[input.work.kind] ?? "CreativeWork",
        name: input.work.title,
        ...(input.work.year ? { datePublished: String(input.work.year) } : {}),
      }
    : null;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    ...(input.description ? { description: input.description } : {}),
    url,
    mainEntityOfPage: url,
    inLanguage: "zh-Hant",
    author,
    publisher: { "@type": "Organization", name: SITE_TITLE, url: input.origin },
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    ...(about ? { about } : {}),
  };
}
