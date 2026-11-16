import { describe, expect, it } from "vitest";
import type { PodcastEpisodeOption, PodcastShowResult } from "@/lib/work-picker/types";
import { latestEpisode, podcastCards } from "./podcast-cards";

function showResult(id: number, artworkUrl: string | null = `https://is1.mzstatic.com/${id}/600x600bb.jpg`): PodcastShowResult {
  return { kind: "podcast", itunesId: id, name: `節目${id}`, artist: "主持人", trackCount: 10, artworkUrl, feedUrl: `https://feed.example/${id}.xml` };
}

function episode(guid: string, publishedAt: string | null): PodcastEpisodeOption {
  return { guid, title: guid, publishedAt, episodeNumber: null, seasonNumber: null, durationSeconds: null, feelingCount: 0 };
}

describe("podcastCards：Apple 台灣本週榜單", () => {
  it("取前 N、meta「Podcast・本週榜單」、封面用 600、主鈕帶 RSS 與 iTunes id", () => {
    const cards = podcastCards([showResult(1), showResult(2, null), showResult(3)], 2);
    expect(cards).toEqual([
      {
        key: "podcast:1",
        title: "節目1",
        posterUrl: "https://is1.mzstatic.com/1/600x600bb.jpg",
        meta: "Podcast・本週榜單",
        placeholder: "podcast",
        workId: null,
        plan: { type: "podcast", itunesId: 1, feedUrl: "https://feed.example/1.xml", show: "節目1" },
        link: { href: "https://podcasts.apple.com/tw/podcast/id1", label: "去聽" },
      },
      expect.objectContaining({ key: "podcast:2", posterUrl: null }),
    ]);
  });
});

describe("latestEpisode：預選最新一集", () => {
  it("看發佈時間取最新；都沒寫時間就用 RSS 第一集；沒有集數回 null", () => {
    expect(latestEpisode([episode("a", "2026-10-01T00:00:00Z"), episode("b", "2026-10-10T00:00:00Z"), episode("c", null)])?.guid).toBe("b");
    expect(latestEpisode([episode("x", null), episode("y", null)])?.guid).toBe("x");
    expect(latestEpisode([])).toBeNull();
  });
});
