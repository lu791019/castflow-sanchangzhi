import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  fetchFeedXml,
  pollAllFeeds,
  subscribeRss,
  validateFeedUrl,
} from "./rss";
import { createAdminClient } from "@/lib/supabase/admin";
import { RssIngestError } from "./rss-errors";

const FEED_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>測試 Podcast</title>
  <item><title>第 3 集</title><guid>g3</guid>
    <pubDate>Wed, 01 Oct 2025 10:00:00 +0000</pubDate>
    <enclosure url="https://cdn.example.com/g3.mp3" type="audio/mpeg"/></item>
  <item><title>第 2 集</title><guid>g2</guid>
    <pubDate>Mon, 15 Sep 2025 10:00:00 +0000</pubDate>
    <enclosure url="https://cdn.example.com/g2.mp3" type="audio/mpeg"/></item>
  <item><title>第 1 集</title><guid>g1</guid>
    <pubDate>Mon, 01 Sep 2025 10:00:00 +0000</pubDate>
    <enclosure url="https://cdn.example.com/g1.mp3" type="audio/mpeg"/></item>
</channel></rss>`;

interface MockDbOptions {
  feedRows?: Array<{ id: string; url: string; title: string | null }>;
  existingGuidsByFeed?: Record<string, string[]>;
  feedInsertError?: { code: string; message: string };
}

/** 覆蓋 rss.ts 用到的 supabase 查詢鏈：insert/select/update + eq/not/maybeSingle */
function makeDb(options: MockDbOptions = {}) {
  const inserted: Record<string, Record<string, unknown>[]> = {};
  const updated: Record<string, Record<string, unknown>[]> = {};
  let episodeCounter = 0;

  const guidsForFeed = (feedId: string) => [
    ...(options.existingGuidsByFeed?.[feedId] ?? []),
    ...(inserted.episodes ?? [])
      .filter((row) => row.feed_id === feedId)
      .map((row) => row.guid as string),
  ];

  const from = (table: string) => ({
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: async () => {
          if (table === "feeds") {
            if (options.feedInsertError) {
              return { data: null, error: options.feedInsertError };
            }
            inserted.feeds = (inserted.feeds ?? []).concat([row]);
            return {
              data: { id: "feed-1", url: row.url, title: row.title },
              error: null,
            };
          }
          inserted.episodes = (inserted.episodes ?? []).concat([row]);
          episodeCounter += 1;
          return { data: { id: `ep-${episodeCounter}` }, error: null };
        },
      }),
    }),
    select: () => {
      if (table === "feeds") {
        return {
          order: async () => ({ data: options.feedRows ?? [], error: null }),
        };
      }
      return {
        eq: (_col: string, feedId: string) => ({
          eq: (_c: string, guid: string) => ({
            maybeSingle: async () => ({
              data: guidsForFeed(feedId).includes(guid)
                ? { id: "existing-ep" }
                : null,
              error: null,
            }),
          }),
          not: async () => ({
            data: guidsForFeed(feedId).map((guid) => ({ guid })),
            error: null,
          }),
          // 補齊欄位：既有 guid 視為 aired_at 尚未補（migration 011 之前入庫）
          is: async () => ({
            data: (options.existingGuidsByFeed?.[feedId] ?? []).map((guid) => ({
              id: `old-${guid}`,
              guid,
            })),
            error: null,
          }),
        }),
      };
    },
    update: (row: Record<string, unknown>) => ({
      eq: async () => {
        updated[table] = (updated[table] ?? []).concat([row]);
        return { error: null };
      },
    }),
  });

  return { client: { from }, inserted, updated };
}

function useDb(db: ReturnType<typeof makeDb>) {
  vi.mocked(createAdminClient).mockReturnValue(
    db.client as unknown as ReturnType<typeof createAdminClient>,
  );
}

function stubFetchXml(xml: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, text: async () => xml })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateFeedUrl", () => {
  it("拒絕空值、非 URL、非 http(s)；接受合法 URL", () => {
    expect(validateFeedUrl(null)).toBeTruthy();
    expect(validateFeedUrl({ feedUrl: "" })).toBeTruthy();
    expect(validateFeedUrl({ feedUrl: "not-a-url" })).toBeTruthy();
    expect(validateFeedUrl({ feedUrl: "ftp://example.com/feed" })).toBeTruthy();
    expect(
      validateFeedUrl({ feedUrl: "https://example.com/feed.xml" }),
    ).toBeNull();
  });
});

describe("fetchFeedXml", () => {
  it("HTTP 非 2xx → fetch_failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })),
    );
    await expect(fetchFeedXml("https://example.com/feed")).rejects.toMatchObject(
      { code: "fetch_failed" },
    );
  });

  it("網路錯誤 → fetch_failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    await expect(
      fetchFeedXml("https://example.com/feed"),
    ).rejects.toBeInstanceOf(RssIngestError);
  });
});

describe("subscribeRss", () => {
  it("建立 feed + 最新 1 集 episode（source='rss'、status='uploaded'、帶 guid/feed_id/audio_url）", async () => {
    const db = makeDb();
    useDb(db);
    stubFetchXml(FEED_XML);

    const result = await subscribeRss("owner-1", "https://example.com/feed.xml");

    expect(result.feed).toEqual({
      id: "feed-1",
      url: "https://example.com/feed.xml",
      title: "測試 Podcast",
    });
    expect(result.episode.title).toBe("第 3 集");

    expect(db.inserted.feeds).toHaveLength(1);
    expect(db.inserted.feeds[0]).toMatchObject({ user_id: "owner-1" });
    expect(db.inserted.episodes).toEqual([
      {
        user_id: "owner-1",
        title: "第 3 集",
        audio_url: "https://cdn.example.com/g3.mp3",
        source: "rss",
        status: "uploaded",
        feed_id: "feed-1",
        guid: "g3",
        aired_at: "2025-10-01T10:00:00.000Z",
        duration_seconds: null,
        episode_number: null,
        season_number: null,
        author: null,
      },
    ]);
  });

  it("重複訂閱同 feed（unique violation）→ already_subscribed", async () => {
    const db = makeDb({
      feedInsertError: { code: "23505", message: "duplicate key" },
    });
    useDb(db);
    stubFetchXml(FEED_XML);

    await expect(
      subscribeRss("owner-1", "https://example.com/feed.xml"),
    ).rejects.toMatchObject({ code: "already_subscribed" });
    expect(db.inserted.episodes).toBeUndefined();
  });
});

describe("pollAllFeeds", () => {
  const FEED_ROW = {
    id: "feed-1",
    url: "https://example.com/feed.xml",
    title: "測試 Podcast",
    user_id: "owner-2",
  };

  it("已入庫 g1 → 補建 g2、g3（舊→新），同 guid 不重複建集", async () => {
    const db = makeDb({ feedRows: [FEED_ROW], existingGuidsByFeed: { "feed-1": ["g1"] } });
    useDb(db);
    stubFetchXml(FEED_XML);

    const results = await pollAllFeeds();

    expect(results).toEqual([
      { feedId: "feed-1", url: FEED_ROW.url, title: "測試 Podcast", added: 2 },
    ]);
    expect(db.inserted.episodes?.map((row) => row.guid)).toEqual(["g2", "g3"]);
    // 新集數沿用 feed 擁有者
    expect(db.inserted.episodes?.map((row) => row.user_id)).toEqual(["owner-2", "owner-2"]);
    expect(db.updated.feeds).toHaveLength(1);
    // 既有 g1 補上播出日期（migration 011 前入庫的集數）
    expect(db.updated.episodes).toEqual([
      expect.objectContaining({ aired_at: "2025-09-01T10:00:00.000Z" }),
    ]);
  });

  it("最新集已入庫 → 新增 0 集", async () => {
    const db = makeDb({ feedRows: [FEED_ROW], existingGuidsByFeed: { "feed-1": ["g3"] } });
    useDb(db);
    stubFetchXml(FEED_XML);

    const results = await pollAllFeeds();

    expect(results[0].added).toBe(0);
    expect(db.inserted.episodes).toBeUndefined();
  });

  it("單一 feed 抓取失敗 → 記錯誤不中斷，其他 feed 照常", async () => {
    const feed2 = { id: "feed-2", url: "https://two.example.com/feed", title: null };
    const db = makeDb({ feedRows: [FEED_ROW, feed2], existingGuidsByFeed: { "feed-1": ["g3"] } });
    useDb(db);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => FEED_XML });
    vi.stubGlobal("fetch", fetchMock);

    const results = await pollAllFeeds();

    expect(results[0].error).toContain("HTTP 500");
    expect(results[0].added).toBe(0);
    expect(results[1].error).toBeUndefined();
    // feed-2 沒有任何已知 guid → 只取最新 1 集
    expect(results[1].added).toBe(1);
  });
});
