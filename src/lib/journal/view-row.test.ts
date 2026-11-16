import { describe, expect, it } from "vitest";
import { articleOf, toJournalViewEntry, type JournalViewRow } from "./view-row";

const base: JournalViewRow = {
  id: "j1",
  experienced_at: "2026-10-07T13:40:00Z",
  venue: "cinema",
  status: "said",
  companions: null,
  work_title_fallback: null,
  works: [{ kind: "movie", title: "海街日記", podcast_show: null, episode_number: null, poster_url: "p.jpg" }],
  episodes: { id: "e1", share_slug: "abc", published_at: "2026-10-07T14:00:00Z", created_at: "2026-10-07T13:58:00Z", source: "audio" },
};

describe("toJournalViewEntry", () => {
  it("已發佈 → 分享頁；嵌入陣列也可", () => {
    const entry = toJournalViewEntry(base);
    expect(entry?.work?.title).toBe("海街日記");
    expect(entry?.article).toEqual({ href: "/s/abc", saidAt: "2026-10-07T13:58:00Z", typed: false });
  });

  it("草稿 → 校樣頁；用打的", () => {
    expect(articleOf({ id: "e2", share_slug: null, published_at: null, created_at: "t", source: "text" })).toEqual({
      href: "/proof/e2",
      saidAt: "t",
      typed: true,
    });
  });

  it("連上文章但仍是 recorded → 沒有 article", () => {
    expect(toJournalViewEntry({ ...base, status: "recorded" })?.article).toBeNull();
  });

  it("不合法場域或狀態 → null", () => {
    expect(toJournalViewEntry({ ...base, venue: "moon" })).toBeNull();
    expect(toJournalViewEntry({ ...base, status: "x" })).toBeNull();
  });
});
