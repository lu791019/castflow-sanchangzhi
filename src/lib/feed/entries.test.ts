import { describe, expect, it } from "vitest";
import {
  buildFeedEntries,
  categoryFromSource,
  editionLabel,
  feedAuthor,
  feedBylineText,
  feedEntryHref,
  feedIssueNo,
  filterFeedEntries,
  formatMastheadDate,
  isListedInFeed,
  parseFeedTab,
  pickTonightQuote,
  type FeedEntry,
} from "./entries";

const BLOG_BODY = [
  "# 看完《海街日記》，我傳了訊息給姊姊",
  "",
  "有些人一直都在，只是我很久沒有好好看她，散場的時候才想起來。",
  "",
  "後面還有一段比較長的描述，講的是回家路上的公車與窗外的燈。",
].join("\n");

function row(overrides: Partial<Parameters<typeof buildFeedEntries>[0][0]> = {}) {
  return {
    id: "ep-1",
    title: "fallback 標題",
    source: "text",
    created_at: "2026-10-08T12:00:00Z",
    share_slug: null,
    blogBody: BLOG_BODY,
    ...overrides,
  };
}

describe("buildFeedEntries", () => {
  it("以 blog 首行標題為主、抽引句與《作品名》", () => {
    const [entry] = buildFeedEntries([row()]);
    expect(entry.title).toBe("看完《海街日記》，我傳了訊息給姊姊");
    expect(entry.quote).toBe(
      "有些人一直都在，只是我很久沒有好好看她，散場的時候才想起來。",
    );
    expect(entry.workTitle).toBe("海街日記");
  });

  it("blog 沒有 # 標題時退回 episode title", () => {
    const [entry] = buildFeedEntries([
      row({ blogBody: "只有一段正文，沒有標題行，但長度足夠構成引句喔。" }),
    ]);
    expect(entry.title).toBe("fallback 標題");
  });

  it("帶內文開頭給寬版封面故事（Q-60）", () => {
    const [entry] = buildFeedEntries([row({ blogBody: "# 標題\n\n第一段正文。\n\n第二段正文。" })]);
    expect(entry.excerpt).toEqual(["第一段正文。", "第二段正文。"]);
  });

  it("作者選定的引言優先於自動抽句", () => {
    const [entry] = buildFeedEntries([row({ pull_quote: "後面還有一段比較長的描述" })]);
    expect(entry.quote).toBe("後面還有一段比較長的描述");
  });
});

describe("buildFeedEntries 海報（join works）", () => {
  it("作品有海報就帶 posterUrl，沒有綁作品為 null", () => {
    const [withPoster, bare] = buildFeedEntries([
      row({ poster_url: "https://image.tmdb.org/t/p/w342/a.jpg" }),
      row({ id: "ep-2" }),
    ]);
    expect(withPoster.posterUrl).toBe("https://image.tmdb.org/t/p/w342/a.jpg");
    expect(bare.posterUrl).toBeNull();
  });

  it("文中抽不到《作品名》時，退回綁定作品的片名", () => {
    const [entry] = buildFeedEntries([
      row({ blogBody: "只有一段正文，沒有標題行，但長度足夠構成引句喔。", work_title: "花樣年華" }),
    ]);
    expect(entry.workTitle).toBe("花樣年華");
  });

  it("文中有《作品名》時以文中為準", () => {
    const [entry] = buildFeedEntries([row({ work_title: "別的片" })]);
    expect(entry.workTitle).toBe("海街日記");
  });
});

describe("isListedInFeed（目錄只列公開）", () => {
  const published = "2026-10-09T00:00:00Z";
  it("公開且已發佈才列；連結/私人/草稿不列", () => {
    expect(isListedInFeed({ source: "text", visibility: "public", published_at: published })).toBe(true);
    expect(isListedInFeed({ source: "text", visibility: "unlisted", published_at: published })).toBe(false);
    expect(isListedInFeed({ source: "audio", visibility: "private", published_at: published })).toBe(false);
    expect(isListedInFeed({ source: "text", visibility: "public", published_at: null })).toBe(false);
  });

  it("RSS 節目沒有發佈流程，公開時照列；缺欄位視為公開", () => {
    expect(isListedInFeed({ source: "rss", visibility: "public", published_at: null })).toBe(true);
    expect(isListedInFeed({ source: "rss" })).toBe(true);
    expect(isListedInFeed({ source: "text" })).toBe(false);
  });
});

describe("categoryFromSource / filter / tab", () => {
  it("categoryFromSource（舊規則，只剩作者統計用）：text → 影劇、rss 與 audio → podcast", () => {
    expect(categoryFromSource("text")).toBe("screen");
    expect(categoryFromSource("rss")).toBe("podcast");
    expect(categoryFromSource("audio")).toBe("podcast");
  });

  it("filterFeedEntries 依分類過濾、all 全留（分類看作品類別，見 categories.test.ts）", () => {
    const entries = buildFeedEntries([
      row({ id: "a", source: "text", work_kind: "movie" }),
      row({ id: "b", source: "rss" }),
    ]);
    expect(filterFeedEntries(entries, "all")).toHaveLength(2);
    expect(filterFeedEntries(entries, "screen").map((e) => e.id)).toEqual([
      "a",
    ]);
    expect(filterFeedEntries(entries, "podcast").map((e) => e.id)).toEqual([
      "b",
    ]);
  });

  it("parseFeedTab 舊網址 screen/podcast 照用，其他回 all", () => {
    expect(parseFeedTab("screen")).toBe("screen");
    expect(parseFeedTab("podcast")).toBe("podcast");
    expect(parseFeedTab("weird")).toBe("all");
    expect(parseFeedTab(undefined)).toBe("all");
  });
});

describe("feedEntryHref", () => {
  it("有 slug 走分享頁、沒有導去校樣（不掉進舊的內容編輯器，UX-04）", () => {
    expect(feedEntryHref({ id: "x", share_slug: "hello" })).toBe("/s/hello");
    expect(feedEntryHref({ id: "x", share_slug: null })).toBe("/proof/x");
  });

  it("RSS podcast 單集進單集閱讀頁（即使有 slug）", () => {
    expect(feedEntryHref({ id: "x", share_slug: "hello", source: "rss" })).toBe("/episodes/x/read");
    expect(feedEntryHref({ id: "x", share_slug: null, source: "text" })).toBe("/proof/x");
  });
});

describe("pickTonightQuote", () => {
  it("取第一個有引句的條目，全部沒有時回 null", () => {
    const noQuote: FeedEntry = {
      ...buildFeedEntries([row()])[0],
      quote: null,
      title: "無引句",
    };
    const withQuote = buildFeedEntries([row()])[0];
    expect(pickTonightQuote([noQuote, withQuote])).toEqual({
      quote: withQuote.quote,
      fromTitle: withQuote.title,
    });
    expect(pickTonightQuote([noQuote])).toBeNull();
  });
});

describe("刊頭日期與期數", () => {
  it("formatMastheadDate 輸出 MM.DD 週X", () => {
    expect(formatMastheadDate(new Date(2026, 9, 8))).toBe("10.08 週四");
  });

  it("editionLabel 依時段切換", () => {
    expect(editionLabel(new Date(2026, 9, 8, 8))).toBe("晨間版");
    expect(editionLabel(new Date(2026, 9, 8, 12))).toBe("午間版");
    expect(editionLabel(new Date(2026, 9, 8, 21))).toBe("晚間版");
  });

  it("feedIssueNo 為當年第幾天補零 4 位", () => {
    expect(feedIssueNo(new Date(2026, 0, 1))).toBe("0001");
    expect(feedIssueNo(new Date(2026, 9, 8))).toBe("0281");
  });
});

describe("feedAuthor：目錄卡署名（UX-23）", () => {
  it("筆名署名 → 作者的筆名", () => {
    expect(feedAuthor({ source: "text", byline: "pen_name", penName: "林小晴" })).toBe("林小晴");
    expect(feedAuthor({ source: "audio", byline: null, penName: "林小晴" })).toBe("林小晴");
  });
  it("匿名署名 → 「匿名」，不露筆名", () => {
    expect(feedAuthor({ source: "text", byline: "anonymous", penName: "林小晴" })).toBe("匿名");
  });
  it("RSS 節目素材沒有作者 → 不署名", () => {
    expect(feedAuthor({ source: "rss", byline: "pen_name", penName: "林小晴" })).toBeNull();
  });
});

describe("feedBylineText", () => {
  it("作品＋署名", () => {
    expect(feedBylineText("海街日記", "林小晴")).toBe("《海街日記》 — 林小晴");
  });
  it("只有其中一個", () => {
    expect(feedBylineText(null, "匿名")).toBe("匿名");
    expect(feedBylineText("海街日記", null)).toBe("《海街日記》");
    expect(feedBylineText(null, null)).toBe("");
  });
});

describe("buildFeedEntries 署名", () => {
  it("帶 author；沒給為 null", () => {
    expect(buildFeedEntries([row({ author: "林小晴" })])[0].author).toBe("林小晴");
    expect(buildFeedEntries([row()])[0].author).toBeNull();
  });
});
