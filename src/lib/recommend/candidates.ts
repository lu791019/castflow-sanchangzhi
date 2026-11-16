/**
 * 推薦候選池（純函式）：只推「現在能去看／聽」的——
 * TMDB 台灣上映中、30 天內即將上映、本週熱門影集、Apple 台灣 Podcast 榜、30 天內的場外場刊。
 * 已經記過、排過、寫過的不推；同一部只留一次（前面的組優先）。
 */

import { addDays, liveCard, screenCards, type LiveWorkRow } from "@/lib/before/cards";
import { quickWatchLink } from "@/lib/links/quick-links";
import { buildSearchLinks } from "@/lib/links/search-links";
import type { PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";
import { UPCOMING_WINDOW_DAYS } from "./constants";
import { screenKey } from "./signals";
import type { Candidate, Exclusions } from "./types";

export interface CandidateSources {
  nowPlaying: readonly ScreenResult[];
  upcoming: readonly ScreenResult[];
  series: readonly ScreenResult[];
  podcasts: readonly PodcastShowResult[];
  live: readonly LiveWorkRow[];
}

export function applePodcastUrl(itunesId: number): string {
  return `https://podcasts.apple.com/tw/podcast/id${itunesId}`;
}

function screenCandidates(kind: "movie" | "series", section: string, items: readonly ScreenResult[]): Candidate[] {
  return screenCards(kind, section, items, items.length).map((card, index) => {
    const item = items[index];
    const link = quickWatchLink({ kind, tmdbId: item.tmdbId, title: item.title, section });
    return { card, media: kind, screen: { kind, tmdbId: item.tmdbId }, link: { label: link.label, url: link.url } };
  });
}

function podcastCandidate(show: PodcastShowResult): Candidate {
  return {
    card: {
      key: `podcast:${show.itunesId}`,
      title: show.name,
      posterUrl: show.artworkUrl,
      meta: ["Podcast・本週熱門", show.artist].filter(Boolean).join("・"),
      placeholder: "screen",
      workId: null,
      // 榜單是節目不是單集，排不進行程；次鈕直接去聽
      plan: null,
    },
    media: "podcast",
    screen: null,
    link: { label: "去聽", url: applePodcastUrl(show.itunesId) },
  };
}

function liveCandidate(row: LiveWorkRow, today: string): Candidate {
  const ticket = buildSearchLinks({ kind: row.kind, venueType: null, title: row.title })[0];
  return {
    card: liveCard(row, today),
    media: row.kind,
    screen: null,
    link: ticket ? { label: ticket.label, url: ticket.url } : null,
  };
}

function withinWindow(item: ScreenResult, today: string): boolean {
  return item.releaseDate !== null && item.releaseDate >= today && item.releaseDate <= addDays(today, UPCOMING_WINDOW_DAYS);
}

function isExcluded(candidate: Candidate, exclusions: Exclusions): boolean {
  if (candidate.screen && exclusions.screenKeys.has(screenKey(candidate.screen.kind, candidate.screen.tmdbId))) return true;
  return candidate.card.workId !== null && exclusions.workIds.has(candidate.card.workId);
}

export function buildCandidates(sources: CandidateSources, today: string, exclusions: Exclusions): Candidate[] {
  const all = [
    ...screenCandidates("movie", "now_playing", sources.nowPlaying),
    ...screenCandidates("movie", "upcoming", sources.upcoming.filter((item) => withinWindow(item, today))),
    ...screenCandidates("series", "trending", sources.series),
    ...sources.podcasts.map(podcastCandidate),
    ...sources.live.map((row) => liveCandidate(row, today)),
  ];
  return all.filter(
    (candidate, index) =>
      !isExcluded(candidate, exclusions) && all.findIndex((other) => other.card.key === candidate.card.key) === index,
  );
}
