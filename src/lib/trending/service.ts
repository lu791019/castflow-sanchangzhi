/**
 * 本週熱門（server only）：四種類型各一份快取，一小時重抓；重抓失敗回上一次並推 warn 警報。
 * 自家感受數每次現算（會變），不進快取。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { itunesDepsFromEnv } from "@/lib/work-picker/itunes";
import { feelingCountsByTmdb } from "@/lib/work-picker/repository";
import { withMusicFeelingCounts } from "@/lib/work-picker/service";
import { tmdbDepsFromEnv } from "@/lib/work-picker/tmdb";
import type { MusicAlbumResult, PickerKind, PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";
import { appleMusicTopUrlFromEnv, loadTrendingAlbums } from "./apple-music-top";
import { appleTopUrlsFromEnv, loadTrendingPodcasts } from "./apple-top";
import { createStaleCache, type StaleCache } from "./stale-cache";
import { loadTrendingMovies, loadTrendingSeries, type TrendingMovies } from "./tmdb-trending";
import { trendingTtlFromEnv } from "./ttl";
import type { TrendingPayload, TrendingSection } from "./types";

const ttlMs = trendingTtlFromEnv();

function onStale(kind: PickerKind) {
  return (error: unknown, ageMs: number) => {
    const detail = `${kind}：${error instanceof Error ? error.message : String(error)}；上一次成功是 ${Math.round(ageMs / 60_000)} 分鐘前`;
    console.error("[trending] 重抓失敗，先用上一次的", { kind, detail });
    void getServerNotify()("warn", "本週熱門讀不到，先用上一次的", detail).catch(() => undefined);
  };
}

const movies: StaleCache<TrendingMovies> = createStaleCache({
  ttlMs,
  load: () => loadTrendingMovies(tmdbDepsFromEnv()),
  onStale: onStale("movie"),
});
const series: StaleCache<ScreenResult[]> = createStaleCache({
  ttlMs,
  load: () => loadTrendingSeries(tmdbDepsFromEnv()),
  onStale: onStale("series"),
});
const podcasts: StaleCache<PodcastShowResult[]> = createStaleCache({
  ttlMs,
  load: () => loadTrendingPodcasts({ fetch: itunesDepsFromEnv().fetch, ...appleTopUrlsFromEnv() }),
  onStale: onStale("podcast"),
});

const albums: StaleCache<MusicAlbumResult[]> = createStaleCache({
  ttlMs,
  load: () => loadTrendingAlbums({ fetch: itunesDepsFromEnv().fetch, topUrl: appleMusicTopUrlFromEnv() }),
  onStale: onStale("music"),
});

async function withFeelingCounts(kind: "movie" | "series", sections: TrendingSection<ScreenResult>[]): Promise<TrendingSection<ScreenResult>[]> {
  const ids = sections.flatMap((section) => section.items.map((item) => item.tmdbId));
  const counts = await feelingCountsByTmdb(kind, ids);
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, feelingCount: counts[item.tmdbId] ?? 0 })),
  }));
}

export async function loadTrending(kind: PickerKind): Promise<TrendingPayload> {
  const fetchedAt = new Date().toISOString();
  if (kind === "music") {
    return { kind, sections: [{ key: "top", title: "本週熱門", items: await withMusicFeelingCounts(await albums.get()) }], fetchedAt };
  }
  if (kind === "podcast") {
    return { kind, sections: [{ key: "top", title: "本週熱門", items: await podcasts.get() }], fetchedAt };
  }
  if (kind === "series") {
    return { kind, sections: await withFeelingCounts(kind, [{ key: "trending", title: "本週熱門", items: await series.get() }]), fetchedAt };
  }
  const { nowPlaying, upcoming } = await movies.get();
  return {
    kind,
    sections: await withFeelingCounts(kind, [
      { key: "now_playing", title: "正在上映", items: nowPlaying },
      { key: "upcoming", title: "即將上映", items: upcoming },
    ]),
    fetchedAt,
  };
}
