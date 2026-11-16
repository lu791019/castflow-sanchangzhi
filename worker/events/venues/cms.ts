/**
 * 國立 CMS 三館共用（純函式）：臺博館、史博館、中正紀念堂的展覽列表（News_actives／News_Actives_photo.aspx）。
 * 每筆 a.div-activity 連到文化部活動報名系統 event.culture.tw 的明細頁（標題、圖都在列表），
 * 史博、中正紀念堂的列表有「日期：2026-10-08 ~ 2027-03-21」「地點：…」；臺博館列表沒有日期 → 抓明細頁「場次」補起訖。
 * 臺博館分四個館區，各取「特展」分類（_CSN=4479）。
 */

import { isNoiseTitle, type CollectedEvent } from "../../../src/lib/events/collected.ts";
import { cleanText } from "../html.ts";
import { absoluteUrl, cityOfVenue, dateRange, venueEvent, venueOf, venueTitle, westernDate, type VenueHome } from "./common.ts";

export type CmsSource = "ntm" | "nmh" | "cksmh";

export interface CmsList {
  url: string;
  /** 這個列表（館區）的場地名稱 */
  home: VenueHome;
}

export interface CmsSite {
  source: CmsSource;
  lists: readonly CmsList[];
  city: string;
}

const NTM_PATTERN = /臺博館|台博館|國立臺灣博物館|國立台灣博物館|本館|古生物館|南門館|鐵道部|展示廳|展間/;
const ntmList = (node: number, name: string): CmsList => ({
  url: `https://www.ntm.gov.tw/News_actives.aspx?n=${node}&sms=13389&_CSN=4479`,
  home: { name, pattern: NTM_PATTERN },
});

export const CMS_SITES: Record<CmsSource, CmsSite> = {
  ntm: {
    source: "ntm",
    city: "臺北市",
    lists: [
      ntmList(5472, "國立臺灣博物館"),
      ntmList(5473, "國立臺灣博物館古生物館"),
      ntmList(5474, "國立臺灣博物館南門館"),
      ntmList(5478, "國立臺灣博物館鐵道部園區"),
    ],
  },
  nmh: {
    source: "nmh",
    city: "臺北市",
    lists: [{ url: "https://www.nmh.gov.tw/News_Actives_photo.aspx?n=6983", home: { name: "國立歷史博物館", pattern: /歷史博物館|史博/ } }],
  },
  cksmh: {
    source: "cksmh",
    city: "臺北市",
    lists: [{ url: "https://www.cksmh.gov.tw/News_Actives_photo.aspx?n=6067", home: { name: "中正紀念堂", pattern: /中正紀念堂|展廳|通廊|藝廊/ } }],
  },
};

export interface CmsItem {
  /** event.culture.tw 的 actId */
  id: string;
  title: string;
  /** 明細頁（event.culture.tw） */
  url: string;
  imageUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
}

const ITEM = /<a href="([^"]*)" class="div-activity" title="[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

function itemOf(href: string, block: string): CmsItem | null {
  const url = absoluteUrl(href, "https://event.culture.tw/");
  const id = url ? /actId=(\d+)/.exec(url)?.[1] : undefined;
  if (!url || !id) return null;
  const period = /<p class="activity-time">日期：([^<]*)<\/p>/.exec(block)?.[1];
  const { start, end } = dateRange(period, westernDate);
  return {
    id,
    title: venueTitle(/<div class="caption">\s*<span>([\s\S]*?)<\/span>/.exec(block)?.[1]),
    url,
    imageUrl: absoluteUrl(/<img src="([^"]*)"/.exec(block)?.[1], url),
    startsOn: start,
    endsOn: end,
    location: cleanText(/<p class="activity-season">地點：([^<]*)<\/p>/.exec(block)?.[1]) || null,
  };
}

/** 列表頁 → 每筆（不判斷收不收）；不像 CMS 列表丟錯 */
export function parseCmsList(html: string, label: string): CmsItem[] {
  if (!html.includes("group-list")) throw new Error(`${label}展覽列表版型不對（找不到 group-list）`);
  return [...html.matchAll(ITEM)].flatMap(([, href, block]) => {
    const item = itemOf(href, block);
    return item ? [item] : [];
  });
}

/** 列表沒日期、標題不是雜訊（工作坊、導覽）才值得抓明細頁 */
export function needsDetail(item: CmsItem): boolean {
  return (!item.startsOn || !item.endsOn) && !!item.title && !isNoiseTitle(item.title);
}

/**
 * event.culture.tw 明細頁「場次」→ 起訖（最早開始～最晚結束）。
 * 「2026/07/14 09:30 ~ 2026/11/01 17:00」；沒有場次回 null，不像明細頁丟錯。
 */
export function parseCultureDetail(html: string): { startsOn: string; endsOn: string } | null {
  if (!html.includes("blockOriginal")) throw new Error("文化部活動明細頁版型不對（找不到場次區塊）");
  const ranges = [...html.matchAll(/(\d{4}\/\d{1,2}\/\d{1,2})[^~<]*~\s*(\d{4}\/\d{1,2}\/\d{1,2})/g)].flatMap(([, start, end]) => {
    const [from, to] = [westernDate(start), westernDate(end)];
    return from && to ? [{ from, to }] : [];
  });
  if (ranges.length === 0) return null;
  return {
    startsOn: ranges.map((range) => range.from).sort()[0],
    endsOn: ranges.map((range) => range.to).sort().at(-1) as string,
  };
}

export function cmsToEvent(site: CmsSite, list: CmsList, item: CmsItem): CollectedEvent | null {
  const venue = venueOf(list.home, item.location);
  return venueEvent({
    source: site.source,
    sourceId: item.id,
    title: item.title,
    venue,
    city: cityOfVenue(venue, list.home, site.city),
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    imageUrl: item.imageUrl,
    sourceUrl: item.url,
  });
}
