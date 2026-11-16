import { describe, it, expect } from "vitest";
import { parseFeed, selectNewItems, type FeedItem } from "./rss-parse";
import { RssIngestError } from "./rss-errors";

// 本地 fixture：文件順序故意「舊集在前」，驗證 pubDate 排序
const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title><![CDATA[測試 Podcast]]></title>
    <link>https://example.com</link>
    <item>
      <title><![CDATA[第 1 集：開張]]></title>
      <guid isPermaLink="false">guid-1</guid>
      <pubDate>Mon, 01 Sep 2025 10:00:00 +0000</pubDate>
      <enclosure url="https://cdn.example.com/ep1.mp3" length="100" type="audio/mpeg"/>
    </item>
    <item>
      <title>第 3 集：最新</title>
      <guid isPermaLink="false">guid-3</guid>
      <pubDate>Wed, 01 Oct 2025 10:00:00 +0000</pubDate>
      <enclosure url="https://cdn.example.com/ep3.mp3" length="300" type="audio/mpeg"/>
    </item>
    <item>
      <title>只有 blog 文沒音訊</title>
      <guid>guid-no-audio</guid>
      <pubDate>Tue, 30 Sep 2025 10:00:00 +0000</pubDate>
    </item>
    <item>
      <title>第 2 集</title>
      <guid isPermaLink="false">guid-2</guid>
      <pubDate>Mon, 15 Sep 2025 10:00:00 +0000</pubDate>
      <enclosure url="https://cdn.example.com/ep2.mp3" length="200" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

const NO_ENCLOSURE_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>純文字 blog</title>
  <item><title>文章一</title><guid>a</guid></item>
</channel></rss>`;

const NOT_RSS_XML = `<?xml version="1.0"?><html><body>not a feed</body></html>`;

describe("parseFeed", () => {
  it("解析 RSS 2.0：feed title、CDATA、guid 屬性節點、enclosure、依 pubDate 新→舊排序", () => {
    const parsed = parseFeed(FEED_XML);

    expect(parsed.title).toBe("測試 Podcast");
    // 無 enclosure 的 item 被濾掉，剩 3 集且新→舊
    expect(parsed.items.map((i) => i.guid)).toEqual([
      "guid-3",
      "guid-2",
      "guid-1",
    ]);
    expect(parsed.items[0]).toEqual({
      guid: "guid-3",
      title: "第 3 集：最新",
      audioUrl: "https://cdn.example.com/ep3.mp3",
      publishedAt: "Wed, 01 Oct 2025 10:00:00 +0000",
      durationSeconds: null,
      episodeNumber: null,
      seasonNumber: null,
      author: null,
    });
    expect(parsed.items[2].title).toBe("第 1 集：開張");
    expect(parsed.imageUrl).toBeNull();
    expect(parsed.author).toBeNull();
  });

  it("閱讀頁欄位：節目封面/作者、單集長度（秒數與 時:分:秒）、季內集數", () => {
    const xml = `<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
      <title>慢慢說</title>
      <itunes:author>heartwander</itunes:author>
      <itunes:image href="https://cdn.example.com/show.jpg"/>
      <item><title>S6 EP.07</title><guid>a</guid>
        <pubDate>Wed, 01 Oct 2025 10:00:00 +0000</pubDate>
        <itunes:duration>00:52:29</itunes:duration>
        <itunes:episode>7</itunes:episode><itunes:season>6</itunes:season>
        <itunes:author>單集作者</itunes:author>
        <enclosure url="https://cdn.example.com/a.mp3" type="audio/mpeg"/></item>
      <item><title>舊集</title><guid>b</guid>
        <pubDate>Mon, 01 Sep 2025 10:00:00 +0000</pubDate>
        <itunes:duration>3044</itunes:duration>
        <itunes:episode></itunes:episode>
        <enclosure url="https://cdn.example.com/b.mp3" type="audio/mpeg"/></item>
    </channel></rss>`;
    const parsed = parseFeed(xml);
    expect(parsed.imageUrl).toBe("https://cdn.example.com/show.jpg");
    expect(parsed.author).toBe("heartwander");
    expect(parsed.items[0]).toMatchObject({
      durationSeconds: 3149,
      episodeNumber: 7,
      seasonNumber: 6,
      author: "單集作者",
    });
    expect(parsed.items[1]).toMatchObject({
      durationSeconds: 3044,
      episodeNumber: null,
      seasonNumber: null,
      author: null,
    });
  });

  it("沒有 itunes:image 時退回 RSS <image><url>", () => {
    const xml = `<rss version="2.0"><channel><title>t</title>
      <image><url>https://cdn.example.com/rss.png</url></image>
      <item><enclosure url="https://cdn.example.com/x.mp3"/></item></channel></rss>`;
    expect(parseFeed(xml).imageUrl).toBe("https://cdn.example.com/rss.png");
  });

  it("單一 item 的 feed 也能解析（item 非陣列）", () => {
    const xml = `<rss version="2.0"><channel><title>單集</title>
      <item><title>唯一集</title>
      <enclosure url="https://cdn.example.com/only.mp3" type="audio/mpeg"/>
      </item></channel></rss>`;
    const parsed = parseFeed(xml);
    expect(parsed.items).toHaveLength(1);
    // 無 guid 時 fallback 用 enclosure url
    expect(parsed.items[0].guid).toBe("https://cdn.example.com/only.mp3");
  });

  it("非 XML → invalid_xml；XML 非 RSS → not_rss；無任何 enclosure → no_enclosure", () => {
    expect(() => parseFeed("<<<不是 xml")).toThrowError(
      expect.objectContaining({ code: "invalid_xml" }),
    );
    expect(() => parseFeed(NOT_RSS_XML)).toThrowError(
      expect.objectContaining({ code: "not_rss" }),
    );
    expect(() => parseFeed(NO_ENCLOSURE_XML)).toThrowError(
      expect.objectContaining({ code: "no_enclosure" }),
    );
    expect(() => parseFeed(NO_ENCLOSURE_XML)).toThrowError(RssIngestError);
  });
});

describe("selectNewItems", () => {
  const items: FeedItem[] = ["g3", "g2", "g1"].map((guid) => ({
    guid,
    title: guid,
    audioUrl: `https://cdn.example.com/${guid}.mp3`,
    publishedAt: null,
    durationSeconds: null,
    episodeNumber: null,
    seasonNumber: null,
    author: null,
  }));

  it("DB 完全沒已知 guid → 只取最新 1 集（避免灌入 back-catalog）", () => {
    expect(selectNewItems(items, new Set()).map((i) => i.guid)).toEqual(["g3"]);
  });

  it("有已知 guid → 取比它更新的所有集（中間漏掉的也補上）", () => {
    expect(selectNewItems(items, new Set(["g1"])).map((i) => i.guid)).toEqual([
      "g3",
      "g2",
    ]);
  });

  it("最新集已入庫 → 無新集", () => {
    expect(selectNewItems(items, new Set(["g3", "g1"]))).toEqual([]);
  });
});
