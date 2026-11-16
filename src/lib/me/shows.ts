/** 我的節目（RSS 訂閱）列：方形字卡、最近一集、主持（純邏輯） */

import { pad2, taipeiParts } from "@/lib/journal/time";

export interface ShowLatestEpisode {
  aired_at: string | null;
  created_at: string;
  episode_number: number | null;
  season_number: number | null;
}

export interface ShowRowInput {
  id: string;
  url: string;
  title: string | null;
  author: string | null;
  image_url: string | null;
  latest: ShowLatestEpisode | null;
}

export interface ShowRow {
  id: string;
  name: string;
  /** 字卡右下角：集數或季（S2） */
  no: string;
  latest: string;
  host: string | null;
  imageUrl: string | null;
}

/** 「第 122 集」「S2 第 14 集」；沒集數 → 空字串 */
function episodeLabel(latest: ShowLatestEpisode): string {
  if (!latest.episode_number) return "";
  const season = latest.season_number && latest.season_number > 1 ? `S${latest.season_number} ` : "";
  return `${season}第 ${latest.episode_number} 集`;
}

/** 「10.08・第 122 集」；沒有集數只寫日期；還沒抓到集數 →「還沒有新集數」 */
export function latestEpisodeLabel(latest: ShowLatestEpisode | null): string {
  if (!latest) return "還沒有新集數";
  const parts = taipeiParts(new Date(latest.aired_at ?? latest.created_at));
  const date = `${pad2(parts.month)}.${pad2(parts.day)}`;
  const label = episodeLabel(latest);
  return label ? `${date}・${label}` : date;
}

function plateNumber(latest: ShowLatestEpisode | null): string {
  if (!latest) return "";
  if (latest.season_number && latest.season_number > 1) return `S${latest.season_number}`;
  return latest.episode_number ? String(latest.episode_number) : "";
}

/** 節目名：沒有標題時用網址主機名，不留空 */
export function showName(input: Pick<ShowRowInput, "title" | "url">): string {
  const title = input.title?.trim();
  if (title) return title;
  try {
    return new URL(input.url).hostname;
  } catch {
    return input.url;
  }
}

export function toShowRow(input: ShowRowInput): ShowRow {
  return {
    id: input.id,
    name: showName(input),
    no: plateNumber(input.latest),
    latest: latestEpisodeLabel(input.latest),
    host: input.author?.trim() || null,
    imageUrl: input.image_url,
  };
}
