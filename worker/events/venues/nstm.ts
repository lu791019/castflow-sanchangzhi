/**
 * 國立科學工藝博物館（純函式）：`ExhibitionList.aspx`（?Pindex=N&Period=2 翻頁），每頁 10 筆，依開始日排：常設展在前、特展在後。
 * 每筆 h3.exhi_word-tit、「展覽日期：113-09-05 ~ 116-08-31」（民國；「常設展」「~ 不定期結束」＝沒有結束日）、FileHandler.ashx 圖。
 * robots.txt 只開放列表頁（活動頁 Exhibition.aspx 不抓，只當官網連結）。網站內容 CC BY-SA 4.0 → 署名要列。
 */

import type { CollectedEvent } from "../../../src/lib/events/collected.ts";
import { absoluteUrl, dateRange, rocDate, venueEvent, venueTitle } from "./common.ts";

export const NSTM_LIST = "https://www.nstm.gov.tw/ExhibitionList.aspx";
/** 每輪最多抓幾頁（第 1 頁＋從最後一頁往前） */
export const NSTM_MAX_PAGES = 3;
const SITE = "https://www.nstm.gov.tw/";

export function nstmPageUrl(page: number): string {
  return page <= 1 ? NSTM_LIST : `${NSTM_LIST}?Pindex=${page}&Period=2`;
}

export interface NstmRow {
  id: string;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  imageUrl: string | null;
  sourceUrl: string;
}

const ITEM = /<div class="exhi_data_list">([\s\S]*?)<div class="exhi_alink">\s*<a href="([^"]*KeyID=([\w-]+)[^"]*)"/g;

function rowOf(block: string, href: string, id: string): NstmRow {
  const title = /<h3 class="exhi_word-tit">([\s\S]*?)<\/h3>/.exec(block)?.[1] ?? "";
  const period = /<i>展覽日期：<\/i>([^<]*)</.exec(block)?.[1] ?? "";
  const { start, end } = dateRange(period, rocDate);
  return {
    id,
    title: venueTitle(title),
    startsOn: start,
    endsOn: end,
    imageUrl: absoluteUrl(/<img src="([^"]*)"/.exec(block)?.[1], SITE),
    sourceUrl: absoluteUrl(href, SITE) ?? `${SITE}Exhibition.aspx?KeyID=${id}`,
  };
}

/** 一頁 → 每筆（含常設展，給收集流程判斷要不要往前翻）＋最後一頁；不像展覽列表丟錯 */
export function parseNstmPage(html: string): { rows: NstmRow[]; lastPage: number } {
  if (!html.includes("exhi_databox")) throw new Error("科工館展覽列表版型不對（找不到 exhi_databox）");
  const rows = [...html.matchAll(ITEM)].map(([, block, href, id]) => rowOf(block, href, id));
  const lastPage = Math.max(1, ...[...html.matchAll(/ExhibitionList\.aspx\?Pindex=(\d+)/g)].map(([, page]) => Number(page)));
  return { rows, lastPage };
}

export function nstmToEvent(row: NstmRow): CollectedEvent | null {
  return venueEvent({
    source: "nstm",
    sourceId: row.id,
    title: row.title,
    venue: "國立科學工藝博物館",
    city: "高雄市",
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    imageUrl: row.imageUrl,
    sourceUrl: row.sourceUrl,
  });
}
