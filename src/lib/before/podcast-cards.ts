/**
 * 散場之前：Podcast 本週榜單（Apple 台灣榜，既有 trending 快取）→ 卡片（純函式）。
 * 作品是單集：主鈕按下去才讀 RSS、預選最新一集（latestEpisode），再開記一筆。
 */

import type { PodcastEpisodeOption, PodcastShowResult } from "@/lib/work-picker/types";
import type { BeforeCard } from "./cards";

export const PODCAST_META = "Podcast・本週榜單";

/** Apple Podcasts 節目頁（與推薦區「去聽」同一個網址） */
function applePodcastUrl(itunesId: number): string {
  return `https://podcasts.apple.com/tw/podcast/id${itunesId}`;
}

export function podcastCards(shows: readonly PodcastShowResult[], limit: number): BeforeCard[] {
  return shows.slice(0, limit).map((show) => ({
    key: `podcast:${show.itunesId}`,
    title: show.name,
    posterUrl: show.artworkUrl,
    meta: PODCAST_META,
    placeholder: "podcast",
    workId: null,
    plan: { type: "podcast", itunesId: show.itunesId, feedUrl: show.feedUrl, show: show.name },
    link: { href: applePodcastUrl(show.itunesId), label: "去聽" },
  }));
}

/** 最新一集：看發佈時間；都沒寫就用 RSS 的第一集 */
export function latestEpisode(episodes: readonly PodcastEpisodeOption[]): PodcastEpisodeOption | null {
  if (episodes.length === 0) return null;
  const time = (episode: PodcastEpisodeOption) => (episode.publishedAt ? Date.parse(episode.publishedAt) || 0 : 0);
  return episodes.reduce((latest, next) => (time(next) > time(latest) ? next : latest));
}
