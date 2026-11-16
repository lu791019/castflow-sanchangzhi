import { describe, expect, it } from "vitest";
import type { LiveWorkRow } from "@/lib/before/cards";
import type { PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";
import { buildCandidates } from "./candidates";

const movie = (tmdbId: number, title: string, releaseDate: string | null = "2026-10-01"): ScreenResult => ({
  kind: "movie",
  tmdbId,
  title,
  originalTitle: null,
  year: 2026,
  region: null,
  posterUrl: null,
  releaseDate,
  feelingCount: 0,
});
const series = (tmdbId: number, title: string): ScreenResult => ({ ...movie(tmdbId, title), kind: "series" });
const show: PodcastShowResult = { kind: "podcast", itunesId: 99, name: "百靈果", artist: "凱文", trackCount: 10, artworkUrl: null, feedUrl: "https://x/rss" };
const live: LiveWorkRow = {
  id: "live-1",
  slug: "live-1",
  kind: "live",
  title: "落日飛車",
  venue: "Legacy Taipei",
  event_date: "2026-10-20",
  event_end_date: null,
  poster_url: null,
};
const none = { screenKeys: new Set<string>(), workIds: new Set<string>() };
const today = "2026-10-14";

describe("buildCandidates", () => {
  it("上映中、30 天內即將上映、本週熱門影集、Podcast 榜、場刊都進池；各帶次鈕", () => {
    const pool = buildCandidates(
      {
        nowPlaying: [movie(1, "上映中")],
        upcoming: [movie(2, "下週上映", "2026-10-20"), movie(3, "太久以後", "2026-12-25"), movie(4, "沒日期", null)],
        series: [series(5, "熱門影集")],
        podcasts: [show],
        live: [live],
      },
      today,
      none,
    );
    expect(pool.map((candidate) => candidate.card.title)).toEqual(["上映中", "下週上映", "熱門影集", "百靈果", "落日飛車"]);
    const [playing, upcoming, tv, podcast, onStage] = pool;
    expect(playing.screen).toEqual({ kind: "movie", tmdbId: 1 });
    expect(playing.link?.label).toBe("訂票");
    expect(upcoming.card.meta).toBe("電影・10.20 上映");
    expect(tv.media).toBe("series");
    expect(podcast.media).toBe("podcast");
    expect(podcast.card.plan).toBeNull();
    expect(podcast.link).toEqual({ label: "去聽", url: "https://podcasts.apple.com/tw/podcast/id99" });
    expect(onStage.media).toBe("live");
    expect(onStage.card.plan?.type).toBe("live");
    expect(onStage.link?.label).toBe("KKTIX");
  });

  it("排除已經記過、排過、寫過的；同一部只留一次", () => {
    const pool = buildCandidates(
      { nowPlaying: [movie(1, "看過了"), movie(2, "還沒看")], upcoming: [movie(2, "還沒看", "2026-10-15")], series: [], podcasts: [], live: [live] },
      today,
      { screenKeys: new Set(["movie:1"]), workIds: new Set(["live-1"]) },
    );
    expect(pool.map((candidate) => candidate.card.title)).toEqual(["還沒看"]);
  });
});
