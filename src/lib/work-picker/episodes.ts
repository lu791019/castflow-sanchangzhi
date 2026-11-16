/** Podcast 第二層（選集數）：RSS feed → 集數選項、集數標籤「S6・EP7」、短日期 */

import type { FeedItem, ParsedFeed } from "@/lib/ingest/rss-parse";
import { episodeNumberLabel } from "@/lib/listen/episode-meta";
import type { PodcastEpisodeOption } from "./types";

export const EPISODE_LIST_MAX = 200;

const TAIPEI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** MM.DD（台北時間）；跨年 YYYY.MM.DD；無法解析 null */
export function formatShortDate(raw: string | null, now: Date = new Date()): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const [year, month, day] = TAIPEI_DATE.format(date).split("-");
  const [thisYear] = TAIPEI_DATE.format(now).split("-");
  return year === thisYear ? `${month}.${day}` : `${year}.${month}.${day}`;
}

/** 列左欄：有集數 → S6・EP7 / EP703；沒集數 → 日期；都沒有 → — */
export function episodeLabel(
  episode: Pick<PodcastEpisodeOption, "episodeNumber" | "seasonNumber" | "publishedAt">,
  now: Date = new Date(),
): string {
  const numbered = episodeNumberLabel(episode);
  if (numbered) return numbered;
  return formatShortDate(episode.publishedAt, now) ?? "—";
}

function toIso(raw: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toOption(item: FeedItem, feelingCounts: Record<string, number>): PodcastEpisodeOption {
  return {
    guid: item.guid,
    title: item.title,
    publishedAt: toIso(item.publishedAt),
    episodeNumber: item.episodeNumber,
    seasonNumber: item.seasonNumber,
    durationSeconds: item.durationSeconds,
    feelingCount: feelingCounts[item.guid] ?? 0,
  };
}

/** feed items（parseFeed 已排新 → 舊）→ 集數選項，最多 200 集 */
export function toEpisodeOptions(
  feed: ParsedFeed,
  feelingCounts: Record<string, number>,
): PodcastEpisodeOption[] {
  return feed.items.slice(0, EPISODE_LIST_MAX).map((item) => toOption(item, feelingCounts));
}

export function findEpisodeByGuid(feed: ParsedFeed, guid: string): FeedItem | null {
  return feed.items.find((item) => item.guid === guid) ?? null;
}
