/**
 * 關渡美術館（純函式）：`/mod/exhibition/index.php` 當期展覽，每檔 a.item（img、div.STitle、div.subt「2026.10.16～2027.01.10」、div.location 展廳）。
 * 活動頁網址帶 REQUEST_ID（加密參數）→ 當 sourceId。
 */

import type { CollectedEvent } from "../../../src/lib/events/collected.ts";
import { absoluteUrl, dateRange, uniqueBySourceId, venueEvent, venueTitle, westernDate } from "./common.ts";

export const KDMOFA_URL = "https://kdmofa.tnua.edu.tw/mod/exhibition/index.php";

const ITEM = /<a href="([^"]*REQUEST_ID=(\w+)[^"]*)" class="item[^"]*">([\s\S]*?)<\/a>/g;

/** 當期展覽頁 → 展覽；不像展覽列表丟錯 */
export function parseKdmofaPage(html: string): CollectedEvent[] {
  if (!html.includes('class="items"')) throw new Error("關渡美術館展覽列表版型不對（找不到 items）");
  const events = [...html.matchAll(ITEM)].flatMap(([, href, id, block]) => {
    const sourceUrl = absoluteUrl(href, KDMOFA_URL);
    if (!sourceUrl) return [];
    const { start, end } = dateRange(/<div class="subt">([^<]*)<\/div>/.exec(block)?.[1], westernDate);
    const event = venueEvent({
      source: "kdmofa",
      sourceId: id,
      title: venueTitle(/<div class="STitle">([\s\S]*?)<\/div>/.exec(block)?.[1]),
      venue: "關渡美術館",
      city: "臺北市",
      startsOn: start,
      endsOn: end,
      imageUrl: absoluteUrl(/<img src='([^']*)'/.exec(block)?.[1] ?? /<img src="([^"]*)"/.exec(block)?.[1], KDMOFA_URL),
      sourceUrl,
    });
    return event ? [event] : [];
  });
  return uniqueBySourceId(events);
}
