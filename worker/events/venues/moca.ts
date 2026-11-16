/**
 * 臺北當代藝術館 MoCA（純函式）：`/tw/ExhibitionAndEvent/Exhibitions`（當期）與 `/Exhibitions/Upcoming`（新展預告），
 * 每檔一個 a.textFrame（h3.imgTitle、h4.imgSubTitle、兩組 span.year＋p.day「09 / 19」）＋同網址的 a.link 圖（img data-src 延遲載入）。
 * 活動頁網址就是標題（/Info/美術館之後）→ 當 sourceId。
 */

import type { CollectedEvent } from "../../../src/lib/events/collected.ts";
import { absoluteUrl, uniqueBySourceId, venueEvent, venueTitle, ymd } from "./common.ts";

export const MOCA_PAGES = [
  "https://www.mocataipei.org.tw/tw/ExhibitionAndEvent/Exhibitions",
  "https://www.mocataipei.org.tw/tw/ExhibitionAndEvent/Exhibitions/Upcoming",
] as const;
const SITE = "https://www.mocataipei.org.tw/";

const FRAME = /<a class="textFrame[^"]*" href="([^"]*)"[^>]*>([\s\S]*?)<div class="moreBtn">/g;
const IMAGE = /<a class="link cg[^"]*" href="([^"]*)"[^>]*>\s*<figure class="imgFrame">\s*<img[^>]*data-src="([^"]*)"/g;
const DAY = /class="year">(\d{4})<\/span>\s*<p class="day">\s*(\d{1,2})\s*\/\s*(\d{1,2})/g;

/** 當期或預告頁 → 展覽；不像展覽列表丟錯（預告頁沒有展覽是正常的） */
export function parseMocaPage(html: string): CollectedEvent[] {
  if (!html.includes("ajax_category_wrap")) throw new Error("當代館展覽列表版型不對（找不到 ajax_category_wrap）");
  const images = new Map([...html.matchAll(IMAGE)].map(([, href, src]) => [href, src]));
  const events = [...html.matchAll(FRAME)].flatMap(([, href, block]) => {
    const sourceUrl = absoluteUrl(href, SITE);
    const id = decodeURIComponent(/\/Info\/([^/?#]+)/.exec(sourceUrl ?? "")?.[1] ?? "");
    if (!sourceUrl || !id) return [];
    const [start, end] = [...block.matchAll(DAY)].map(([, year, month, day]) => ymd(Number(year), Number(month), Number(day)));
    const event = venueEvent({
      source: "moca",
      sourceId: id,
      title: venueTitle(/<h3 class="imgTitle">([\s\S]*?)<\/h3>/.exec(block)?.[1]),
      venue: "臺北當代藝術館",
      city: "臺北市",
      startsOn: start ?? null,
      endsOn: end ?? null,
      imageUrl: absoluteUrl(images.get(href), SITE),
      sourceUrl,
    });
    return event ? [event] : [];
  });
  return uniqueBySourceId(events);
}
