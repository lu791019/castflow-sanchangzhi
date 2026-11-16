import { describe, expect, it, vi } from "vitest";
import { APPLE_TOP_URL, appleTopUrlsFromEnv, loadTrendingPodcasts, lookupPodcasts, parseAppleTopIds } from "./apple-top";

const topFeed = { feed: { results: [{ id: "1", name: "甲" }, { id: "2", name: "乙" }, { id: "bad" }, { id: "3" }] } };
const lookup = {
  results: [
    { collectionId: 3, collectionName: "丙", artistName: "C", feedUrl: "https://c/rss", artworkUrl600: "https://c/a.jpg" },
    { collectionId: 1, collectionName: "甲", artistName: "A", feedUrl: "https://a/rss" },
    { collectionId: 2, collectionName: "乙（沒 RSS）" },
  ],
};

function fakeFetch(map: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(map).find((prefix) => url.startsWith(prefix));
    if (!key) return new Response("nf", { status: 404 });
    return new Response(JSON.stringify(map[key]), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("Apple 台灣 Top 30 → iTunes lookup 補 RSS", () => {
  it("榜單只取數字 id，依名次排列", () => {
    expect(parseAppleTopIds(topFeed)).toEqual([1, 2, 3]);
    expect(parseAppleTopIds({})).toEqual([]);
  });

  it("lookup 依榜單順序回、丟掉沒 feedUrl 的", async () => {
    const fetch = fakeFetch({ "https://itunes.apple.com/lookup": lookup });
    const shows = await lookupPodcasts([1, 2, 3], { fetch });
    expect(shows.map((show) => show.name)).toEqual(["甲", "丙"]);
    const url = String((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(url).toContain("id=1%2C2%2C3");
    expect(url).toContain("country=tw");
  });

  it("整條：榜單 → lookup；榜單壞掉丟錯", async () => {
    const fetch = fakeFetch({ [APPLE_TOP_URL]: topFeed, "https://itunes.apple.com/lookup": lookup });
    expect((await loadTrendingPodcasts({ fetch })).map((show) => show.itunesId)).toEqual([1, 3]);
    await expect(loadTrendingPodcasts({ fetch: fakeFetch({}) })).rejects.toThrow("Apple 榜單 回應 404");
  });
});

describe("appleTopUrlsFromEnv：只給本機 E2E 指到假 Apple", () => {
  it("非 production 才吃 APPLE_TOP_URL／ITUNES_LOOKUP_URL", async () => {
    const env = { NODE_ENV: "development", APPLE_TOP_URL: "http://127.0.0.1:3166/apple/top.json", ITUNES_LOOKUP_URL: "http://127.0.0.1:3166/apple/lookup" };
    expect(appleTopUrlsFromEnv(env)).toEqual({ topUrl: env.APPLE_TOP_URL, lookupUrl: env.ITUNES_LOOKUP_URL });
    expect(appleTopUrlsFromEnv({ ...env, NODE_ENV: "production" })).toEqual({});
    expect(appleTopUrlsFromEnv({ NODE_ENV: "test" })).toEqual({});

    const fetch = fakeFetch({ [env.APPLE_TOP_URL]: topFeed, [env.ITUNES_LOOKUP_URL]: lookup });
    const shows = await loadTrendingPodcasts({ fetch, ...appleTopUrlsFromEnv(env) });
    expect(shows.map((show) => show.itunesId)).toEqual([1, 3]);
  });
});
