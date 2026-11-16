import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PoliteFetcher } from "./fetcher.ts";
import { collectAccupass, collectKktix, collectOpentix, collectTfam, DETAIL_CAPS, type SourceContext } from "./sources.ts";
import type { PageMemo } from "./state.ts";

const FIXTURES = path.join(__dirname, "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");
const NOW = Date.parse("2026-10-15T02:00:00Z");
const EMPTY_FEED = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>';

/** 假網路：網址 → 回應；沒列到的丟 404；記下打過哪些 */
function fakeFetcher(routes: Record<string, string | (() => string)>, json: Record<string, unknown> = {}): PoliteFetcher & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getText: async (url) => {
      calls.push(url);
      const route = routes[url];
      if (route === undefined) throw new Error(`${url} 回應 404`);
      return typeof route === "function" ? route() : route;
    },
    postJson: async (url, body) => {
      calls.push(`${url} ${body}`);
      const key = JSON.parse(body).Type as string;
      if (!(key in json)) throw new Error(`${url} 回應 500`);
      return json[key];
    },
    counts: () => ({}),
  };
}

function context(fetcher: PoliteFetcher, memos: Record<string, PageMemo> = {}): SourceContext & { memos: Map<string, PageMemo> } {
  const memos2 = new Map(Object.entries(memos));
  return {
    fetcher,
    today: "2026-10-15",
    now: NOW,
    capScale: 1,
    memos: memos2,
    memo: (url) => memos2.get(url),
    remember: (url, memo) => void memos2.set(url, memo),
  };
}

describe("collectKktix", () => {
  it("逐頁讀到空頁；30 天內的補圖片；已結束的不收", async () => {
    const fetcher = fakeFetcher({
      "https://kktix.com/events.atom?category_id=4": fixture("kktix", "performance.atom"),
      "https://kktix.com/events.atom?category_id=4&page=2": EMPTY_FEED,
      "https://kktix.com/events.atom?category_id=11": fixture("kktix", "exhibition.atom"),
      "https://kktix.com/events.atom?category_id=11&page=2": EMPTY_FEED,
      "https://reitianwenhuayishu.kktix.cc/events/dabeb856": fixture("kktix", "event-dabeb856.html"),
    });
    const ctx = context(fetcher);
    const { events, pageFailures } = await collectKktix(ctx);
    expect(events.length).toBeGreaterThanOrEqual(8);
    expect(events.every((event) => event.endsOn >= "2026-10-15")).toBe(true);
    expect(events.find((event) => event.sourceId === "CollectionEvent-124617")?.imageUrl).toMatch(/^https:\/\/assets\.kktix\.io\//);
    // 沒有 fixture 的活動頁 404 → 記成失敗、活動照收（沒圖）
    expect(pageFailures.length).toBeGreaterThan(0);
    expect(ctx.memos.get("https://reitianwenhuayishu.kktix.cc/events/dabeb856")?.image).toMatch(/^https:/);
  });

  it("圖片抓過 30 天內不再抓", async () => {
    const fetcher = fakeFetcher({
      "https://kktix.com/events.atom?category_id=4": fixture("kktix", "performance.atom"),
      "https://kktix.com/events.atom?category_id=4&page=2": EMPTY_FEED,
      "https://kktix.com/events.atom?category_id=11": EMPTY_FEED,
    });
    const memos = Object.fromEntries(
      ["https://saltsweeet.kktix.cc/events/robinfmtaipei2026", "https://7eo8rge.kktix.cc/events/9abe9b97", "https://reitianwenhuayishu.kktix.cc/events/dabeb856", "https://comedyclub.kktix.cc/events/thecutautumn", "https://comedyclub.kktix.cc/events/get2026", "https://comedyclub.kktix.cc/events/jjselect"].map((url) => [url, { fetchedAt: NOW - 86_400_000, image: "https://img/x.jpg" }]),
    );
    const { events, pageFailures } = await collectKktix(context(fetcher, memos));
    expect(fetcher.calls.every((url) => url.startsWith("https://kktix.com/events.atom"))).toBe(true);
    expect(pageFailures).toEqual([]);
    expect(events.every((event) => event.imageUrl === "https://img/x.jpg")).toBe(true);
  });

  it("列表被擋（403）整個來源丟錯", async () => {
    await expect(collectKktix(context(fakeFetcher({})))).rejects.toThrow(/404|403/);
  });
});

describe("collectOpentix", () => {
  const sitemap = fixture("opentix", "sitemap.xml");

  it("新的先抓、記下抓過的；7 天內不重抓、已結束的不抓", async () => {
    const routes: Record<string, string> = { "https://www.opentix.life/otWebSitemap.xml": sitemap };
    for (const id of ["2095065236091641857", "2063941379521384448", "2095816296718020609"]) {
      routes[`https://www.opentix.life/event/${id}`] = fixture("opentix", `event-${id}.html`);
    }
    const fetcher = fakeFetcher(routes);
    const ctx = context(fetcher, {
      "https://www.opentix.life/event/1606114530117398530": { fetchedAt: NOW - 2 * 86_400_000, endsOn: "2026-12-01" },
      "https://www.opentix.life/event/1681876419374891009": { fetchedAt: NOW - 30 * 86_400_000, endsOn: "2026-01-01" },
    });
    const { events } = await collectOpentix(ctx);
    expect(events.map((event) => event.sourceId).sort()).toEqual(["2063941379521384448", "2095065236091641857"]);
    expect(fetcher.calls).not.toContain("https://www.opentix.life/event/1606114530117398530");
    expect(fetcher.calls).not.toContain("https://www.opentix.life/event/1681876419374891009");
    // 影展頁也記下來（下次不重抓）
    expect(ctx.memos.get("https://www.opentix.life/event/2095816296718020609")).toEqual({ fetchedAt: NOW, endsOn: null });
    const eventCalls = fetcher.calls.filter((url) => url.includes("/event/")).map((url) => BigInt(url.split("/").pop() ?? "0"));
    expect(eventCalls).toEqual([...eventCalls].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0)));
  });

  it("每輪最多抓上限頁數；幾天跑一輪上限就乘幾倍（平均每天請求數不變）", async () => {
    const urls = Array.from({ length: DETAIL_CAPS.opentixPages * 3 + 20 }, (_, index) => `<url><loc>https://www.opentix.life/event/${BigInt("2000000000000000000") + BigInt(index)}</loc></url>`);
    const sitemap = { "https://www.opentix.life/otWebSitemap.xml": `<?xml version="1.0"?><urlset>${urls.join("")}</urlset>` };
    expect((await collectOpentix(context(fakeFetcher(sitemap)))).pageFailures).toHaveLength(DETAIL_CAPS.opentixPages);
    expect((await collectOpentix({ ...context(fakeFetcher(sitemap)), capScale: 3 })).pageFailures).toHaveLength(DETAIL_CAPS.opentixPages * 3);
  });
});

describe("collectAccupass", () => {
  it("四組搜尋、去重、課程不抓活動頁、有詳情就補", async () => {
    const search = fixture("accupass", "search-music.html");
    const fetcher = fakeFetcher({
      "https://www.accupass.com/search?c=music&t=this-week": search,
      "https://www.accupass.com/search?c=music&t=next-week": search,
      "https://www.accupass.com/search?c=arts&t=this-week": search,
      "https://www.accupass.com/search?c=arts&t=next-week": search,
      "https://www.accupass.com/event/2609160806171007001595": fixture("accupass", "event-2609160806171007001595.html"),
    });
    const { events } = await collectAccupass(context(fetcher));
    expect(new Set(events.map((event) => event.sourceId)).size).toBe(events.length);
    expect(events.find((event) => event.sourceId === "2609160806171007001595")).toMatchObject({ venue: "鳴石音樂空間", city: "臺北市" });
    expect(fetcher.calls).not.toContain("https://www.accupass.com/event/2609081447234510451260");
    expect(events.some((event) => /課/.test(event.title))).toBe(false);
  });
});

describe("collectTfam", () => {
  it("現正＋即將展出", async () => {
    const fetcher = fakeFetcher({}, { "1": JSON.parse(fixture("tfam", "current.json")), "2": JSON.parse(fixture("tfam", "upcoming.json")) });
    const { events } = await collectTfam(context(fetcher));
    expect(events.map((event) => event.sourceId)).toEqual(["813", "814", "816", "800", "817", "818"]);
  });

  it("其中一個請求失敗就整個來源丟錯", async () => {
    const fetcher = fakeFetcher({}, { "1": JSON.parse(fixture("tfam", "current.json")) });
    await expect(collectTfam(context(fetcher))).rejects.toThrow(/500/);
  });
});
