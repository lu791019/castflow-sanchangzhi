import { describe, expect, it, vi } from "vitest";
import type { TmdbDeps } from "@/lib/work-picker/tmdb";
import { loadTrendingMovies, loadTrendingSeries, mergeMovies, TRENDING_LIMIT } from "./tmdb-trending";

const movie = (id: number) => ({ kind: "movie" as const, tmdbId: id, title: `m${id}`, originalTitle: null, year: null, region: null, posterUrl: null, releaseDate: null, feelingCount: 0 });

function deps(routes: Record<string, unknown>): TmdbDeps {
  return {
    apiKey: "k",
    readAccessToken: null,
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const body = routes[url.pathname.replace("/3", "")];
      return new Response(JSON.stringify(body ?? { results: [] }), { status: 200 });
    }) as unknown as typeof fetch,
  };
}

describe("TMDB 本週熱門", () => {
  it("即將上映排除已在上映名單；各最多 20 筆", () => {
    const playing = Array.from({ length: 25 }, (_, i) => movie(i + 1));
    const upcoming = [movie(3), movie(100), movie(101)];
    const merged = mergeMovies(playing, upcoming);
    expect(merged.nowPlaying).toHaveLength(TRENDING_LIMIT);
    expect(merged.upcoming.map((item) => item.tmdbId)).toEqual([100, 101]);
  });

  it("電影打 now_playing＋upcoming（region=TW）；影集打 trending/tv/week", async () => {
    const d = deps({
      "/movie/now_playing": { results: [{ id: 1, title: "甲", release_date: "2026-10-01" }] },
      "/movie/upcoming": { results: [{ id: 1, title: "甲" }, { id: 2, title: "乙", release_date: "2026-11-01" }] },
      "/trending/tv/week": { results: [{ id: 9, name: "劇", first_air_date: "2025-01-01", origin_country: ["KR"] }, { id: 10 }] },
    });
    const movies = await loadTrendingMovies(d);
    expect(movies.nowPlaying.map((item) => item.title)).toEqual(["甲"]);
    expect(movies.upcoming.map((item) => item.title)).toEqual(["乙"]);
    const urls = (d.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.includes("region=TW"))).toBe(true);
    const series = await loadTrendingSeries(d);
    expect(series).toEqual([expect.objectContaining({ kind: "series", tmdbId: 9, title: "劇", year: 2025 })]);
  });
});
