/**
 * 影劇本週熱門（TMDB）：電影＝台灣「正在上映」＋「即將上映」（region=TW）；影集＝本週趨勢。
 * TMDB 熱門偏全球，台灣在地榜之後靠自爬補（CPO 10/13），這裡先不做。
 */

import { normalizeMovie, normalizeTv, tmdbGet, type TmdbDeps } from "@/lib/work-picker/tmdb";
import type { ScreenResult } from "@/lib/work-picker/types";

export const TRENDING_LIMIT = 20;
const REGION = "TW";

type Raw = Record<string, unknown>;

function rows(data: Raw): Raw[] {
  return Array.isArray(data.results) ? (data.results as Raw[]) : [];
}

export interface TrendingMovies {
  nowPlaying: ScreenResult[];
  upcoming: ScreenResult[];
}

/** 即將上映排除已在上映名單裡的（TMDB 兩個端點會重疊） */
export function mergeMovies(nowPlaying: ScreenResult[], upcoming: ScreenResult[]): TrendingMovies {
  const playing = nowPlaying.slice(0, TRENDING_LIMIT);
  const seen = new Set(playing.map((item) => item.tmdbId));
  return {
    nowPlaying: playing,
    upcoming: upcoming.filter((item) => !seen.has(item.tmdbId)).slice(0, TRENDING_LIMIT),
  };
}

export async function loadTrendingMovies(deps: TmdbDeps): Promise<TrendingMovies> {
  const [playing, upcoming] = await Promise.all([
    tmdbGet("/movie/now_playing", { region: REGION, page: "1" }, deps),
    tmdbGet("/movie/upcoming", { region: REGION, page: "1" }, deps),
  ]);
  const normalize = (data: Raw) => rows(data).map(normalizeMovie).filter((item): item is ScreenResult => item !== null);
  return mergeMovies(normalize(playing), normalize(upcoming));
}

export async function loadTrendingSeries(deps: TmdbDeps): Promise<ScreenResult[]> {
  const data = await tmdbGet("/trending/tv/week", { page: "1" }, deps);
  return rows(data)
    .map(normalizeTv)
    .filter((item): item is ScreenResult => item !== null)
    .slice(0, TRENDING_LIMIT);
}
