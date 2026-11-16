import { describe, expect, it } from "vitest";
import type { FeedEntry } from "./entries";
import { feedIndex } from "./index-column";

function entry(partial: Partial<FeedEntry>): FeedEntry {
  return {
    id: Math.random().toString(36),
    title: "t",
    quote: null,
    workTitle: null,
    posterUrl: null,
    category: "screen",
    href: "/s/x",
    createdAt: "2026-10-10T00:00:00Z",
    ...partial,
  } as FeedEntry;
}

describe("feedIndex", () => {
  it("欄目依分類計數，沒有的分類不列", () => {
    const result = feedIndex([entry({ category: "screen" }), entry({ category: "screen" }), entry({ category: "podcast" })]);
    expect(result.columns).toEqual([
      { key: "screen", label: "影劇", count: 2, href: "/?tab=screen" },
      { key: "podcast", label: "Podcast", count: 1, href: "/?tab=podcast" },
    ]);
    expect(feedIndex([entry({ category: "podcast" })]).columns.map((c) => c.key)).toEqual(["podcast"]);
  });

  it("被說起的作品依次數排序，同數依第一次出現，最多三部", () => {
    const result = feedIndex([
      entry({ workTitle: "海街日記" }),
      entry({ workTitle: "請回答1988" }),
      entry({ workTitle: "海街日記" }),
      entry({ workTitle: "慢慢說", category: "podcast" }),
      entry({ workTitle: "花樣年華" }),
      entry({ workTitle: null }),
    ]);
    expect(result.works).toEqual([
      { title: "海街日記", category: "screen", count: 2, posterUrl: null },
      { title: "請回答1988", category: "screen", count: 1, posterUrl: null },
      { title: "慢慢說", category: "podcast", count: 1, posterUrl: null },
    ]);
  });

  it("縮圖取該作品第一筆有海報的條目", () => {
    const result = feedIndex([
      entry({ workTitle: "海街日記" }),
      entry({ workTitle: "海街日記", posterUrl: "https://image.tmdb.org/p.jpg" }),
      entry({ workTitle: "海街日記", posterUrl: "https://image.tmdb.org/other.jpg" }),
    ]);
    expect(result.works[0].posterUrl).toBe("https://image.tmdb.org/p.jpg");
  });

  it("寬版海報架可以多要幾部（Q-60），排序規則不變", () => {
    const titles = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛"];
    const result = feedIndex(titles.map((workTitle) => entry({ workTitle })), 7);
    expect(result.works.map((work) => work.title)).toEqual(titles.slice(0, 7));
  });
});
