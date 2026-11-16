/**
 * 松山文創園區（純函式）：`/exhibition`（?page=2…）展演列表，上方輪播（a > img.top_img + p.title + p.date）
 * 和下方列表（div.rows：p.date + p.lv_h2 + a.btn）都有活動，兩邊合併。日期「2026-10-01 - 2026-10-31」或只寫一天。
 * 園區是租借場地：市集、博覽會、比賽、品牌快閃也在列表裡 → 只收標題看得出是展覽的（「展」）。
 */

import { titleCategory, type CollectedEvent } from "../../../src/lib/events/collected.ts";
import { cleanText } from "../html.ts";
import { absoluteUrl, uniqueBySourceId, venueEvent, venueTitle, westernDate } from "./common.ts";

export const SONGSHAN_LIST = "https://www.songshanculturalpark.org/exhibition";
/** 每輪最多翻幾頁 */
export const SONGSHAN_MAX_PAGES = 3;
const SITE = "https://www.songshanculturalpark.org/";
const VENUE = "松山文創園區";

export function songshanPageUrl(page: number): string {
  return page <= 1 ? SONGSHAN_LIST : `${SONGSHAN_LIST}?page=${page}`;
}

interface SongshanItem {
  id: string;
  title: string;
  date: string;
  image: string;
}

const SLIDE = /<a href="\/exhibition\/activity\/([\w-]+)">\s*<img class="top_img" src="([^"]*)">\s*<p class="title">([\s\S]*?)<\/p>\s*<p class="date[^"]*">([^<]*)<\/p>/g;
const ROW =
  /<div class="rows">\s*<span class="row_lt"><img src="([^"]*)"><\/span>\s*<span class="row_rt">\s*<p class="date[^"]*">([^<]*)<\/p>\s*<p class="lv_h2">([\s\S]*?)<\/p>[\s\S]*?<a class="btn" href="\/exhibition\/activity\/([\w-]+)">/g;

function itemsOf(html: string): SongshanItem[] {
  const slides = [...html.matchAll(SLIDE)].map(([, id, image, title, date]) => ({ id, title, date, image }));
  const rows = [...html.matchAll(ROW)].map(([, image, date, title, id]) => ({ id, title, date, image }));
  return [...slides, ...rows];
}

function toEvent(item: SongshanItem): CollectedEvent | null {
  const title = venueTitle(item.title);
  if (titleCategory(title) !== "exhibition") return null;
  const [start = "", end = ""] = cleanText(item.date).split(/\s+-\s+/);
  return venueEvent({
    source: "songshan",
    sourceId: item.id,
    title,
    venue: VENUE,
    city: "臺北市",
    startsOn: westernDate(start),
    endsOn: end ? westernDate(end) : null,
    imageUrl: absoluteUrl(item.image, SITE),
    sourceUrl: `${SITE}exhibition/activity/${item.id}`,
  });
}

/** 一頁 → 展覽＋總頁數；不像展演列表丟錯（版型變了） */
export function parseSongshanPage(html: string): { events: CollectedEvent[]; pages: number } {
  if (!html.includes('id="news_list"')) throw new Error("松菸展演列表版型不對（找不到 news_list）");
  const events = itemsOf(html).flatMap((item) => {
    const event = toEvent(item);
    return event ? [event] : [];
  });
  const pages = Math.max(1, ...[...html.matchAll(/\/exhibition\?page=(\d+)/g)].map(([, page]) => Number(page)));
  return { events: uniqueBySourceId(events), pages };
}
