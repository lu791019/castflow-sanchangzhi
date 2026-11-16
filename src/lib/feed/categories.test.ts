import { describe, expect, it } from "vitest";
import { buildFeedEntries, CATEGORY_LABELS, FEED_TABS, feedCategory, filterFeedEntries, parseFeedTab } from "./entries";
import { feedIndex } from "./index-column";

const BODY = "# 標題\n\n一段內文，說說看完之後想到的事。";

function row(id: string, source: string, workKind: string | null) {
  return { id, title: id, source, created_at: "2026-10-15T00:00:00Z", share_slug: id, blogBody: BODY, work_kind: workKind };
}

describe("目錄分類改看作品類別（Q-61）", () => {
  it("影劇（電影＋影集）／Podcast／音樂／演出／展覽；沒綁作品歸隨筆；RSS 節目素材維持 Podcast", () => {
    expect(feedCategory({ source: "text", work_kind: "movie" })).toBe("screen");
    expect(feedCategory({ source: "audio", work_kind: "series" })).toBe("screen");
    expect(feedCategory({ source: "audio", work_kind: "podcast_episode" })).toBe("podcast");
    expect(feedCategory({ source: "text", work_kind: "music" })).toBe("music");
    expect(feedCategory({ source: "audio", work_kind: "live" })).toBe("live");
    expect(feedCategory({ source: "text", work_kind: "exhibition" })).toBe("exhibition");
    expect(feedCategory({ source: "text", work_kind: null })).toBe("essay");
    expect(feedCategory({ source: "audio", work_kind: null })).toBe("essay");
    expect(feedCategory({ source: "rss", work_kind: null })).toBe("podcast");
  });

  it("分頁順序與標籤：全部／影劇／Podcast／音樂／演出／展覽／隨筆", () => {
    expect(FEED_TABS.map((tab) => tab.label)).toEqual(["全部", "影劇", "Podcast", "音樂", "演出", "展覽", "隨筆"]);
    expect(FEED_TABS.map((tab) => tab.href)).toEqual([
      "/?tab=all",
      "/?tab=screen",
      "/?tab=podcast",
      "/?tab=music",
      "/?tab=live",
      "/?tab=exhibition",
      "/?tab=essay",
    ]);
    expect(CATEGORY_LABELS).toEqual({ screen: "影劇", podcast: "PODCAST", music: "音樂", live: "演出", exhibition: "展覽", essay: "隨筆" });
  });

  it("網址參數：新分類照收；舊的 screen／podcast 照用；常見別名對到新分類；其他回全部", () => {
    for (const tab of ["all", "screen", "podcast", "music", "live", "exhibition", "essay"]) expect(parseFeedTab(tab)).toBe(tab);
    expect(parseFeedTab("movie")).toBe("screen");
    expect(parseFeedTab("series")).toBe("screen");
    expect(parseFeedTab("performance")).toBe("live");
    expect(parseFeedTab("festival")).toBe("live");
    expect(parseFeedTab(" Podcast ")).toBe("podcast");
    expect(parseFeedTab("weird")).toBe("all");
    expect(parseFeedTab(undefined)).toBe("all");
  });

  it("條目帶分類、字卡類型跟著作品；沒綁作品的字卡類型是 essay", () => {
    const entries = buildFeedEntries([
      row("m", "text", "movie"),
      row("a", "text", "music"),
      row("l", "audio", "live"),
      row("e", "text", null),
      row("r", "rss", null),
    ]);
    expect(entries.map((entry) => [entry.id, entry.category, entry.workKind])).toEqual([
      ["m", "screen", "movie"],
      ["a", "music", "music"],
      ["l", "live", "live"],
      ["e", "essay", "essay"],
      ["r", "podcast", "podcast_episode"],
    ]);
    expect(filterFeedEntries(entries, "music").map((entry) => entry.id)).toEqual(["a"]);
    expect(filterFeedEntries(entries, "essay").map((entry) => entry.id)).toEqual(["e"]);
  });

  it("桌機索引欄目：依新分類計數，順序同分頁，空的不列", () => {
    const entries = buildFeedEntries([row("a", "text", "music"), row("e", "text", null), row("m", "text", "movie"), row("x", "text", "exhibition")]);
    expect(feedIndex(entries).columns.map((column) => [column.key, column.label, column.href])).toEqual([
      ["screen", "影劇", "/?tab=screen"],
      ["music", "音樂", "/?tab=music"],
      ["exhibition", "展覽", "/?tab=exhibition"],
      ["essay", "隨筆", "/?tab=essay"],
    ]);
  });
});
