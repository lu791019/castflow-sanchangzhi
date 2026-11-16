/**
 * 開放資料兩館（政府資料開放授權條款第 1 版，純函式）：
 * - 科博館特展（data.gov.tw 7499）：JSON `{ itemList: [{ title, dateStart: "2026/11/06", dateEnd, location, mainImage, url }] }`
 * - 海生館特展（data.gov.tw 90320）：JSON 陣列 `[{ 特展名稱, 展出地點, app用開始時間, app用結束時間, 相關圖片, Source }]`，
 *   日期混民國「1150618」與西元「2023-12-15」、常空白；相關圖片是「說明(https://…),」串起來
 * location 是館內位置（「生命科學廳/1F/…」）→ 場地只寫館名，同北美館；海生館巡迴到別館的用那個館當場地。
 * 科博館圖檔回 `Cross-Origin-Resource-Policy: same-site`（10/15 實測，瀏覽器擋 ERR_BLOCKED_BY_RESPONSE.NotSameSite），
 * 別站嵌不了 → 不存圖網址，卡片直接用字卡（存了反而讓同名去重誤以為它「有圖」）。
 */

import type { CollectedEvent } from "../../../src/lib/events/collected.ts";
import { cleanText } from "../html.ts";
import { absoluteUrl, anyDate, cityOfVenue, uniqueBySourceId, venueEvent, venueOf, venueTitle, westernDate, type VenueHome } from "./common.ts";

export const NMNS_URL = "https://www.nmns.edu.tw/backend/opendata/Exhibition/list?key=571fe588-7dae-4cab-8805-8143f910d88a";
export const NMMBA_URL = "https://www.nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB";
const NMNS_SITE = "https://www.nmns.edu.tw/";
const NMMBA_SITE = "https://www.nmmba.gov.tw/";
const NMNS_VENUE = "國立自然科學博物館";
const NMMBA_HOME: VenueHome = { name: "國立海洋生物博物館", pattern: /海洋生物博物館|海生館|珊瑚王國|水域館|本館/ };

type Raw = Record<string, unknown>;

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label}不是 JSON`);
  }
}

const records = (list: unknown[]): Raw[] => list.filter((item): item is Raw => !!item && typeof item === "object");

export function parseNmnsExhibitions(text: string): CollectedEvent[] {
  const data = parseJson(text, "科博館特展開放資料");
  const list = data && typeof data === "object" ? (data as Raw).itemList : undefined;
  if (!Array.isArray(list)) throw new Error("科博館特展開放資料格式不對（沒有 itemList）");
  const events = records(list).flatMap((raw) => {
    const sourceUrl = absoluteUrl(raw.url, NMNS_SITE);
    if (!sourceUrl) return [];
    const event = venueEvent({
      source: "nmns",
      sourceId: /Exhibition-(\d+)/.exec(sourceUrl)?.[1] ?? sourceUrl,
      title: venueTitle(raw.title),
      venue: NMNS_VENUE,
      city: "臺中市",
      startsOn: westernDate(raw.dateStart),
      endsOn: westernDate(raw.dateEnd),
      imageUrl: null,
      sourceUrl,
    });
    return event ? [event] : [];
  });
  return uniqueBySourceId(events);
}

/** 「主視覺(https://…/a.jpg),橫式(https://…/b.jpg),」→ 第一張 */
export function firstPictureUrl(value: unknown): string | null {
  const match = /\((https?:\/\/[^()\s]+)\)/.exec(typeof value === "string" ? value : "");
  return match ? absoluteUrl(match[1], NMMBA_SITE) : null;
}

export function parseNmmbaExhibitions(text: string): CollectedEvent[] {
  const data = parseJson(text, "海生館特展開放資料");
  if (!Array.isArray(data)) throw new Error("海生館特展開放資料格式不對（不是陣列）");
  const events = records(data).flatMap((raw) => {
    const sourceUrl = absoluteUrl(raw.Source, NMMBA_SITE);
    if (!sourceUrl) return [];
    const venue = venueOf(NMMBA_HOME, raw["展出地點"]);
    const event = venueEvent({
      source: "nmmba",
      sourceId: new URL(sourceUrl).searchParams.get("s") ?? sourceUrl,
      title: venueTitle(raw["特展名稱"]),
      venue,
      city: cityOfVenue(venue, NMMBA_HOME, "屏東縣"),
      startsOn: anyDate(cleanText(raw["app用開始時間"])),
      endsOn: anyDate(cleanText(raw["app用結束時間"])),
      imageUrl: firstPictureUrl(raw["相關圖片"]),
      sourceUrl,
    });
    return event ? [event] : [];
  });
  return uniqueBySourceId(events);
}
