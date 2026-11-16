import { describe, expect, it } from "vitest";
import type { MusicAlbumResult } from "@/lib/work-picker/types";
import { buildBeforeCards, cardMedia, CARD_LIMITS, rankCardsByTaste } from "./cards";
import { availableFilters, BEFORE_FILTERS, filterCards } from "./filter";
import { musicCards, MUSIC_META } from "./music-cards";

function album(id: number, artworkUrl: string | null = `https://is1.mzstatic.com/${id}/600x600bb.jpg`): MusicAlbumResult {
  return { kind: "music", itunesId: id, title: `專輯${id}`, artist: "歌手", year: 2026, trackCount: null, artworkUrl, feelingCount: 0 };
}

const empty = { nowPlaying: [], upcoming: [], series: [], live: [] };

describe("musicCards：Apple Music 台灣熱門專輯", () => {
  it("取前 N、meta「音樂・本週熱門」、主鈕帶 iTunes id、次鈕去 Apple Music 聽", () => {
    expect(MUSIC_META).toBe("音樂・本週熱門");
    expect(musicCards([album(6812635395), album(2, null), album(3)], 2)).toEqual([
      {
        key: "music:6812635395",
        title: "專輯6812635395",
        posterUrl: "https://is1.mzstatic.com/6812635395/600x600bb.jpg",
        meta: "音樂・本週熱門",
        placeholder: "music",
        workId: null,
        plan: { type: "music", itunesId: 6812635395, title: "專輯6812635395" },
        link: { href: "https://music.apple.com/tw/album/6812635395", label: "去聽" },
      },
      expect.objectContaining({ key: "music:2", posterUrl: null }),
    ]);
  });
});

describe("散場之前：音樂卡進卡片與分類切換", () => {
  it("有專輯就有音樂卡（上限 CARD_LIMITS.music），屬於 music 類", () => {
    const cards = buildBeforeCards({ ...empty, albums: Array.from({ length: 10 }, (_, index) => album(index + 1)) }, "2026-10-15");
    expect(cards).toHaveLength(CARD_LIMITS.music);
    expect(cards.every((card) => cardMedia(card) === "music")).toBe(true);
  });

  it("分類：全部／電影／影集／Podcast／音樂／演出／展覽；只有有卡的類別出現", () => {
    expect(BEFORE_FILTERS.map((filter) => filter.label)).toEqual(["全部", "電影", "影集", "Podcast", "音樂", "演出", "展覽"]);
    const cards = musicCards([album(1)], 1);
    expect(availableFilters(cards)).toEqual(["all", "music"]);
    expect(filterCards(cards, "music").map((card) => card.key)).toEqual(["music:1"]);
    expect(filterCards(cards, "podcast")).toEqual([]);
  });

  it("品味排序：音樂跟 Podcast 同屬在家聽的，不會報錯也照保底混排", () => {
    const cards = musicCards([album(1), album(2)], 2);
    const ranked = rankCardsByTaste(cards, {
      hasSignal: true,
      media: { movie: 0, series: 0, podcast: 1, live: 0, exhibition: 0 },
      setting: { home: 1, out: 0 },
    } as Parameters<typeof rankCardsByTaste>[1]);
    expect(ranked.map((card) => card.key)).toEqual(["music:1", "music:2"]);
  });
});
