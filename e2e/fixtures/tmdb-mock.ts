/**
 * 假 TMDB（作品推薦 E2E 用）：在 Playwright 這端起一個本機 HTTP server，回固定的上映、熱門影集與作品詳情。
 * dev server 要以 `TMDB_API_BASE=http://127.0.0.1:<port>/3` 啟動才會打到這裡（正式環境不吃這個變數）。
 */

import { createServer, type Server } from "node:http";

export const TMDB_MOCK_PORT = Number(process.env.E2E_TMDB_MOCK_PORT ?? 3163);

/** 種子：使用者寫過的那部 */
export const SEED_MOVIE = { id: 990100, title: "推薦測試・人聲" };
/** 種子的 recommendations 名單裡、也正在上映的那部 */
export const HIT_MOVIE = { id: 990001, title: "推薦測試・新片甲" };
/** 正在上映、跟種子沒關係 */
export const OTHER_MOVIE = { id: 990002, title: "推薦測試・新片乙" };
export const TREND_SERIES = { id: 990010, name: "推薦測試・熱門影集" };

type Json = Record<string, unknown>;

function movieDetail(id: number, title: string, extra: Json = {}): Json {
  return {
    id,
    title,
    original_title: title,
    release_date: "2026-10-01",
    poster_path: null,
    genres: [{ id: 18, name: "劇情" }],
    production_countries: [{ iso_3166_1: "TW" }],
    credits: { crew: [{ id: id + 1_000_000, name: `${title} 的導演`, job: "Director" }], cast: [] },
    recommendations: { results: [] },
    similar: { results: [] },
    ...extra,
  };
}

const ROUTES: Record<string, Json> = {
  "/3/movie/now_playing": {
    results: [
      { id: OTHER_MOVIE.id, title: OTHER_MOVIE.title, release_date: "2026-10-01", poster_path: null },
      { id: HIT_MOVIE.id, title: HIT_MOVIE.title, release_date: "2026-10-02", poster_path: null },
    ],
  },
  "/3/movie/upcoming": { results: [] },
  "/3/trending/tv/week": { results: [{ id: TREND_SERIES.id, name: TREND_SERIES.name, first_air_date: "2026-09-01", poster_path: null }] },
  [`/3/movie/${SEED_MOVIE.id}`]: movieDetail(SEED_MOVIE.id, SEED_MOVIE.title, {
    recommendations: { results: [{ id: HIT_MOVIE.id }] },
  }),
  [`/3/movie/${HIT_MOVIE.id}`]: movieDetail(HIT_MOVIE.id, HIT_MOVIE.title),
  [`/3/movie/${OTHER_MOVIE.id}`]: movieDetail(OTHER_MOVIE.id, OTHER_MOVIE.title, { genres: [{ id: 35, name: "喜劇" }] }),
  [`/3/tv/${TREND_SERIES.id}`]: { id: TREND_SERIES.id, name: TREND_SERIES.name, genres: [], created_by: [], credits: { cast: [] } },
};

export interface TmdbMock {
  hits: string[];
  close: () => Promise<void>;
}

/** 假 TMDB 的回應（沒有這條回 null）；外部服務路由在假 server 沒起時也用這份回假作品 id 的詳情 */
export function tmdbMockBody(path: string): Json | null {
  return ROUTES[path] ?? (path.endsWith("/watch/providers") ? { results: {} } : null);
}

export async function startTmdbMock(): Promise<TmdbMock> {
  const hits: string[] = [];
  const server: Server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://mock").pathname;
    hits.push(path);
    const body = tmdbMockBody(path);
    response.writeHead(body ? 200 : 404, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body ?? { status_message: "not found" }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(TMDB_MOCK_PORT, "127.0.0.1", () => resolve());
  });
  return { hits, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
