import { describe, expect, it } from "vitest";
import type { FeedItem, ParsedFeed } from "@/lib/ingest/rss-parse";
import { WORK_SLUG_PATTERN } from "@/lib/works/format";
import {
  countByWorkId,
  manualWorkInsert,
  podcastWorkInsert,
  tmdbWorkInsert,
  uniqueInOrder,
} from "./work-rows";

describe("tmdbWorkInsert", () => {
  it("電影詳情 → works 列（含 slug、tmdb_id）", () => {
    expect(
      tmdbWorkInsert({
        kind: "movie",
        tmdbId: 331482,
        title: "海街日記",
        originalTitle: "海街diary",
        year: 2015,
        region: "日本",
        posterUrl: "https://img/p.jpg",
        credit: "是枝裕和",
      }),
    ).toEqual({
      kind: "movie",
      title: "海街日記",
      original_title: "海街diary",
      year: 2015,
      region: "日本",
      credit: "是枝裕和",
      poster_url: "https://img/p.jpg",
      tmdb_id: 331482,
      podcast_show: null,
      episode_number: null,
      slug: "movie-331482",
      feed_url: null,
      itunes_id: null,
      episode_guid: null,
    });
  });
  it("電影有片長 → runtime_minutes（migration 032）", () => {
    const row = tmdbWorkInsert({
      kind: "movie",
      tmdbId: 331482,
      title: "海街日記",
      originalTitle: null,
      year: 2015,
      region: null,
      posterUrl: null,
      credit: null,
      runtimeMinutes: 128,
    });
    expect(row.runtime_minutes).toBe(128);
  });
  it("年份超出 works_year_range（1880–2100）時存 null，不讓 DB 拒絕", () => {
    const row = tmdbWorkInsert({
      kind: "series",
      tmdbId: 1,
      title: "x",
      originalTitle: null,
      year: 1800,
      region: null,
      posterUrl: null,
      credit: null,
    });
    expect(row.year).toBeNull();
    expect(row.kind).toBe("series");
  });
});

describe("podcastWorkInsert", () => {
  const show: ParsedFeed = { title: "股癌 Gooaye", imageUrl: "https://img/c.jpg", author: "謝孟恭", items: [] };
  const item: FeedItem = {
    guid: "g-703",
    title: "EP703 | 說點什麼",
    audioUrl: "https://a/703.mp3",
    publishedAt: "Tue, 06 Oct 2026 10:00:00 GMT",
    durationSeconds: 2880,
    episodeNumber: 703,
    seasonNumber: null,
    author: null,
  };
  it("單集 → podcast_episode 列：title=單集名、podcast_show=節目、封面=節目封面、credit=作者、year=播出年", () => {
    const row = podcastWorkInsert({ feedUrl: "https://f/x.xml", show, item, itunesId: 42 });
    expect(row).toMatchObject({
      kind: "podcast_episode",
      title: "EP703 | 說點什麼",
      original_title: null,
      year: 2026,
      region: null,
      credit: "謝孟恭",
      poster_url: "https://img/c.jpg",
      tmdb_id: null,
      podcast_show: "股癌 Gooaye",
      episode_number: 703,
      feed_url: "https://f/x.xml",
      itunes_id: 42,
      episode_guid: "g-703",
    });
    expect(WORK_SLUG_PATTERN.test(row.slug)).toBe(true);
  });
  it("封面：iTunes 600 優先於 RSS itunes:image；iTunes 沒給退回 RSS", () => {
    const withArtwork = podcastWorkInsert({
      feedUrl: "https://f/x.xml",
      show,
      item,
      itunesId: 42,
      artworkUrl: "https://is1.mzstatic.com/x/600x600bb.jpg",
    });
    expect(withArtwork.poster_url).toBe("https://is1.mzstatic.com/x/600x600bb.jpg");
    const fallback = podcastWorkInsert({ feedUrl: "https://f/x.xml", show, item, itunesId: 42, artworkUrl: null });
    expect(fallback.poster_url).toBe("https://img/c.jpg");
  });
  it("單集作者優先於節目作者；沒日期 year null；沒節目名用 feed 主機名", () => {
    const row = podcastWorkInsert({
      feedUrl: "https://feeds.example.com/x.xml",
      show: { ...show, title: null, author: null },
      item: { ...item, author: "來賓", publishedAt: null },
      itunesId: null,
    });
    expect(row.credit).toBe("來賓");
    expect(row.year).toBeNull();
    expect(row.podcast_show).toBe("feeds.example.com");
    expect(row.itunes_id).toBeNull();
  });
});

describe("manualWorkInsert", () => {
  it("只有 kind + title，其餘 null，slug 帶 nonce", () => {
    const row = manualWorkInsert({ kind: "movie", title: "夜車上的海" }, 1700000000000);
    expect(row).toMatchObject({
      kind: "movie",
      title: "夜車上的海",
      original_title: null,
      year: null,
      poster_url: null,
      tmdb_id: null,
      podcast_show: null,
      episode_number: null,
      feed_url: null,
      episode_guid: null,
    });
    expect(WORK_SLUG_PATTERN.test(row.slug)).toBe(true);
  });
});

describe("uniqueInOrder", () => {
  it("去重保序、略過 null，限制數量", () => {
    expect(uniqueInOrder(["a", null, "b", "a", "c", "b"], 2)).toEqual(["a", "b"]);
    expect(uniqueInOrder([], 6)).toEqual([]);
  });
});

describe("countByWorkId", () => {
  it("逐 work_id 計數", () => {
    expect(countByWorkId([{ work_id: "a" }, { work_id: "b" }, { work_id: "a" }])).toEqual({ a: 2, b: 1 });
  });
});
