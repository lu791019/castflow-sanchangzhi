import { describe, expect, it } from "vitest";
import { buildMeArticles, type MeEpisodeRow } from "./me-articles";

const row = (id: string, overrides: Partial<MeEpisodeRow> = {}): MeEpisodeRow => ({
  id,
  title: `標題 ${id}`,
  source: "text",
  created_at: "2026-10-01T00:00:00Z",
  share_slug: `slug-${id}`,
  published_at: "2026-10-02T00:00:00Z",
  blogBody: `# 文章 ${id}\n\n內文。`,
  work: { kind: "movie", title: "海街日記" },
  ...overrides,
});

describe("buildMeArticles（我的：發表過的感受只算已發佈，UX-04）", () => {
  it("未發佈的草稿不列入、不算進已發表，另計草稿數", () => {
    const result = buildMeArticles([
      row("pub"),
      row("draft", { share_slug: null, published_at: null }),
      row("no-body", { blogBody: null, share_slug: null, published_at: null }),
    ]);
    expect(result.published.map((entry) => entry.id)).toEqual(["pub"]);
    expect(result.stats.publishedCount).toBe(1);
    expect(result.draftCount).toBe(2);
  });

  it("發表過的連到公開文章頁，不會連到舊編輯器", () => {
    const [entry] = buildMeArticles([row("pub")]).published;
    expect(entry.href).toBe("/s/slug-pub");
    expect(entry.title).toBe("文章 pub");
  });

  it("RSS 節目不是作者的文章：不列、不算草稿", () => {
    const result = buildMeArticles([row("rss", { source: "rss" })]);
    expect(result.published).toEqual([]);
    expect(result.draftCount).toBe(0);
  });

  it("分類由作品類型推（UX-18）：演出→場外、Podcast→PODCAST；沒綁作品不顯示分類", () => {
    const result = buildMeArticles([
      row("live", { work: { kind: "live", title: "草東沒有派對" } }),
      row("pod", { source: "audio", work: { kind: "podcast_episode", title: "EP1" } }),
      row("free", { work: null }),
    ]);
    expect(result.published.map((entry) => entry.categoryLabel)).toEqual(["場外", "PODCAST", null]);
  });

  it("開欄月份與最常寫只看已發佈；依發佈時間由新到舊", () => {
    const result = buildMeArticles([
      row("old", { published_at: "2026-08-30T00:00:00Z" }),
      row("new", { published_at: "2026-10-05T00:00:00Z" }),
      row("draft", { created_at: "2026-07-01T00:00:00Z", share_slug: null, published_at: null }),
      row("pod", { work: { kind: "podcast_episode", title: "EP1" } }),
    ]);
    expect(result.stats.sinceMonth).toBe("2026.08");
    expect(result.stats.mostWritten).toBe("影劇");
    expect(result.published.map((entry) => entry.id)).toEqual(["new", "pod", "old"]);
    expect(result.published[0].date).toBe("2026-10-05T00:00:00Z");
  });

  it("沒發表過：空狀態值", () => {
    const result = buildMeArticles([row("draft", { share_slug: null, published_at: null })]);
    expect(result.stats).toEqual({ sinceMonth: null, publishedCount: 0, mostWritten: "—" });
  });
});
