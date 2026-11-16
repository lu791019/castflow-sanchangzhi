import { describe, expect, it } from "vitest";
import type { ParsedFeed } from "@/lib/ingest/rss-parse";
import { episodeLabel, findEpisodeByGuid, formatShortDate, toEpisodeOptions } from "./episodes";

const feed: ParsedFeed = {
  title: "股癌 Gooaye",
  imageUrl: "https://img.example/cover.jpg",
  author: "謝孟恭",
  items: [
    {
      guid: "g-703",
      title: "EP703 | 說點什麼",
      audioUrl: "https://a/703.mp3",
      publishedAt: "Tue, 06 Oct 2026 10:00:00 GMT",
      durationSeconds: 2880,
      episodeNumber: 703,
      seasonNumber: null,
      author: null,
    },
    {
      guid: "g-702",
      title: "S6 第七集",
      audioUrl: "https://a/702.mp3",
      publishedAt: "Tue, 29 Sep 2026 10:00:00 GMT",
      durationSeconds: null,
      episodeNumber: 7,
      seasonNumber: 6,
      author: null,
    },
    {
      guid: "g-x",
      title: "無集數",
      audioUrl: "https://a/x.mp3",
      publishedAt: null,
      durationSeconds: 60,
      episodeNumber: null,
      seasonNumber: null,
      author: null,
    },
  ],
};

describe("episodeLabel", () => {
  it("有季有集 → S6・EP7；只有集 → EP703", () => {
    expect(episodeLabel({ episodeNumber: 7, seasonNumber: 6, publishedAt: null })).toBe("S6・EP7");
    expect(episodeLabel({ episodeNumber: 703, seasonNumber: null, publishedAt: null })).toBe("EP703");
  });
  it("沒集數 → 用日期 MM.DD；連日期都沒有 → 「—」", () => {
    expect(
      episodeLabel({ episodeNumber: null, seasonNumber: 3, publishedAt: "2026-10-06T10:00:00Z" }),
    ).toBe("10.06");
    expect(episodeLabel({ episodeNumber: null, seasonNumber: null, publishedAt: null })).toBe("—");
  });
});

describe("formatShortDate", () => {
  it("MM.DD（台北時間）", () => {
    expect(formatShortDate("Tue, 06 Oct 2026 10:00:00 GMT", new Date("2026-10-09T00:00:00Z"))).toBe("10.06");
  });
  it("跨年顯示年份", () => {
    expect(formatShortDate("2025-12-31T10:00:00Z", new Date("2026-10-09T00:00:00Z"))).toBe("2025.12.31");
  });
  it("無法解析回 null", () => {
    expect(formatShortDate("nope")).toBeNull();
    expect(formatShortDate(null)).toBeNull();
  });
});

describe("toEpisodeOptions", () => {
  it("保留 feed 順序、ISO 化日期、帶感受數（預設 0）", () => {
    const options = toEpisodeOptions(feed, { "g-702": 2 });
    expect(options.map((o) => o.guid)).toEqual(["g-703", "g-702", "g-x"]);
    expect(options[0].publishedAt).toBe("2026-10-06T10:00:00.000Z");
    expect(options[0].feelingCount).toBe(0);
    expect(options[1].feelingCount).toBe(2);
    expect(options[2].publishedAt).toBeNull();
  });
  it("最多 200 集", () => {
    const big: ParsedFeed = {
      ...feed,
      items: Array.from({ length: 250 }, (_, i) => ({ ...feed.items[0], guid: `g${i}` })),
    };
    expect(toEpisodeOptions(big, {})).toHaveLength(200);
  });
});

describe("findEpisodeByGuid", () => {
  it("找到回 item，找不到回 null", () => {
    expect(findEpisodeByGuid(feed, "g-702")?.title).toBe("S6 第七集");
    expect(findEpisodeByGuid(feed, "nope")).toBeNull();
  });
});
