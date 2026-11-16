/**
 * 臺南市美術館（純函式）：`/exhibition/current`、`/exhibition/upcoming`，每檔在小版、大版各出現一次（a.display-item），
 * 標題中英並列（只留中文）、期間 span.date／span.date.end_date「2026/06/30」、圖是相對 https://www.tnam.museum 的路徑。
 * 日文、韓文版頁面（標題有假名）跳過，同一檔中文版已收。網站宣告允許再利用、須註明出處。
 */

import type { CollectedEvent } from "../../../src/lib/events/collected.ts";
import { absoluteUrl, uniqueBySourceId, venueEvent, venueTitle, westernDate } from "./common.ts";

export const TNAM_PAGES = ["https://www.tnam.museum/exhibition/current", "https://www.tnam.museum/exhibition/upcoming"] as const;
const SITE = "https://www.tnam.museum/";
const KANA = /[぀-ヿ]/;

const ITEM = /<a class="display-item" href="([^"]*exhibition\/detail\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g;

function toEvent(href: string, id: string, block: string): CollectedEvent | null {
  const raw = /<div class="subject">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "";
  if (KANA.test(raw)) return null;
  const sourceUrl = absoluteUrl(href, SITE);
  if (!sourceUrl) return null;
  return venueEvent({
    source: "tnam",
    sourceId: id,
    title: venueTitle(raw),
    venue: "臺南市美術館",
    city: "臺南市",
    startsOn: westernDate(/<span class="date">([^<]*)</.exec(block)?.[1]),
    endsOn: westernDate(/<span class="date end_date">([^<]*)</.exec(block)?.[1]),
    imageUrl: absoluteUrl(/<img src="([^"]*)"/.exec(block)?.[1], SITE),
    sourceUrl,
  });
}

/** 當期或預告頁 → 展覽；不像展覽頁丟錯（預告頁沒有展覽是正常的） */
export function parseTnamPage(html: string): CollectedEvent[] {
  if (!html.includes("unit_title exhibitions")) throw new Error("南美館展覽頁版型不對（找不到 unit_title exhibitions）");
  const events = [...html.matchAll(ITEM)].flatMap(([, href, id, block]) => {
    const event = toEvent(href, id, block);
    return event ? [event] : [];
  });
  return uniqueBySourceId(events);
}
