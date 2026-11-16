import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PoliteFetcher } from "../fetcher.ts";
import type { SourceContext } from "../sources.ts";
import type { PageMemo } from "../state.ts";
import { VENUE_COLLECTORS, VENUE_DETAIL_CAP, VENUE_DETAIL_MAX_AGE_MS } from "./collectors.ts";

const FIXTURES = path.join(__dirname, "..", "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");
const NOW = Date.parse("2026-10-15T02:00:00Z");

/** 假 fetcher：網址 → 內容；記下打過哪些網址，沒準備的網址丟錯（模擬 403） */
function fakeFetcher(pages: Record<string, string>) {
  const requested: string[] = [];
  const fetcher: PoliteFetcher = {
    getText: async (url) => {
      requested.push(url);
      if (!(url in pages)) throw new Error(`${url} 回應 403`);
      return pages[url];
    },
    postJson: async () => {
      throw new Error("不該用 POST");
    },
    counts: () => ({}),
  };
  return { fetcher, requested };
}

function context(fetcher: PoliteFetcher, today = "2026-10-15", memos: Record<string, PageMemo> = {}) {
  const pages = new Map(Object.entries(memos));
  const value: SourceContext = {
    fetcher,
    today,
    now: NOW,
    capScale: 7,
    memo: (url) => pages.get(url),
    remember: (url, memo) => void pages.set(url, memo),
  };
  return { value, pages };
}

describe("館方來源收集流程", () => {
  it("科博館：一次請求；已結束的不送", async () => {
    const { fetcher, requested } = fakeFetcher({ "https://www.nmns.edu.tw/backend/opendata/Exhibition/list?key=571fe588-7dae-4cab-8805-8143f910d88a": fixture("nmns", "list.json") });
    const result = await VENUE_COLLECTORS.nmns(context(fetcher, "2026-10-20").value);
    expect(requested).toHaveLength(1);
    // 有影在反毒 10/18 結束
    expect(result.events.map((event) => event.title)).not.toContain("有影在反毒");
    expect(result.events).toHaveLength(7);
  });

  it("松菸：翻到最後一頁、跨頁去重", async () => {
    const { fetcher, requested } = fakeFetcher({
      "https://www.songshanculturalpark.org/exhibition": fixture("songshan", "list-1.html"),
      "https://www.songshanculturalpark.org/exhibition?page=2": fixture("songshan", "list-2.html"),
    });
    const result = await VENUE_COLLECTORS.songshan(context(fetcher).value);
    expect(requested).toHaveLength(2);
    expect(result.events).toHaveLength(6);
  });

  it("科工館：第 1 頁看總頁數，從最後一頁往前，遇到常設或太早開始的頁就停（3 次請求）", async () => {
    const list = "https://www.nstm.gov.tw/ExhibitionList.aspx";
    const { fetcher, requested } = fakeFetcher({
      [list]: fixture("nstm", "list-1.html"),
      [`${list}?Pindex=4&Period=2`]: fixture("nstm", "list-4.html"),
      [`${list}?Pindex=3&Period=2`]: fixture("nstm", "list-3.html"),
    });
    const result = await VENUE_COLLECTORS.nstm(context(fetcher).value);
    expect(requested).toEqual([list, `${list}?Pindex=4&Period=2`, `${list}?Pindex=3&Period=2`]);
    expect(result.events.map((event) => event.title)).toHaveLength(3);
  });

  it("列表失敗（例如 403）整個來源丟錯，讓 collector 警報", async () => {
    const { fetcher } = fakeFetcher({});
    await expect(VENUE_COLLECTORS.kdmofa(context(fetcher).value)).rejects.toThrow(/403/);
  });

  it("臺博館：四個館區列表；特展抓明細補日期並記 memo，30 天內不重抓；明細失敗只記下來", async () => {
    const lists = [5472, 5473, 5474, 5478].map((node) => `https://www.ntm.gov.tw/News_actives.aspx?n=${node}&sms=13389&_CSN=4479`);
    const special = fixture("ntm", "special-5472.html");
    const empty = '<div class="group-list"></div>';
    const detail = "https://event.culture.tw/mocweb/reg/NTM/Detail.init.ctr?actId=60183";
    const { fetcher, requested } = fakeFetcher({ [lists[0]]: special, [lists[1]]: empty, [lists[2]]: empty, [lists[3]]: empty, [detail]: fixture("ntm", "detail-60183.html") });
    const ctx = context(fetcher);
    const result = await VENUE_COLLECTORS.ntm(ctx.value);
    // 4 個列表＋4 個特展明細（數位導覽不抓）；其中 3 個明細沒準備 → 失敗記下來
    expect(requested.filter((url) => url.includes("event.culture.tw"))).toHaveLength(4);
    expect(result.pageFailures).toHaveLength(3);
    expect(result.events.map((event) => [event.title, event.startsOn, event.endsOn, event.venue])).toEqual([
      ["骨早味：異特龍記憶與化石繪圖", "2026-07-14", "2026-11-01", "國立臺灣博物館"],
    ]);
    expect(ctx.pages.get(detail)).toEqual({ fetchedAt: NOW, startsOn: "2026-07-14", endsOn: "2026-11-01" });

    // 第二輪：memo 還新鮮就不重抓
    const again = fakeFetcher({ [lists[0]]: special, [lists[1]]: empty, [lists[2]]: empty, [lists[3]]: empty });
    const second = await VENUE_COLLECTORS.ntm(context(again.fetcher, "2026-10-15", { [detail]: { fetchedAt: NOW - VENUE_DETAIL_MAX_AGE_MS + 1, startsOn: "2026-07-14", endsOn: "2026-11-01" } }).value);
    expect(again.requested).not.toContain(detail);
    expect(second.events).toHaveLength(1);
  });

  it("明細頁每輪有上限", async () => {
    const items = Array.from({ length: VENUE_DETAIL_CAP + 5 }, (_, index) => `<a href="https://event.culture.tw/mocweb/reg/NTM/Detail.init.ctr?actId=${index + 1}" class="div-activity" title="t"><div class="caption"> <span>特展 第${index + 1}號</span></div></a>`);
    const lists = [5472, 5473, 5474, 5478].map((node) => `https://www.ntm.gov.tw/News_actives.aspx?n=${node}&sms=13389&_CSN=4479`);
    const html = `<div class="group-list">${items.join("")}</div>`;
    const { fetcher, requested } = fakeFetcher(Object.fromEntries(lists.map((url) => [url, html])));
    await VENUE_COLLECTORS.ntm(context(fetcher).value);
    expect(requested.filter((url) => url.includes("event.culture.tw"))).toHaveLength(VENUE_DETAIL_CAP);
  });
});
