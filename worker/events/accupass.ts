/**
 * Accupass 活動通（純函式）：搜尋頁 `search?c=<類>&t=<時段>` 的伺服器渲染資料（Next.js RSC 字串裡的 initialSearchedEvents，
 * 每頁 25 筆、沒分頁）→ 活動頁 JSON-LD 補地址與大圖。只抓 /search 與 /event/<id>（robots 擋的購票、會員頁不碰）。
 * RSC 是前端內部格式，改版就會解析失敗 → 丟錯讓 collector 警報。
 */

import { cityFromAddress, type CollectedEvent } from "../../src/lib/events/collected.ts";
import { buildEvent } from "./build.ts";
import { cleanText, jsonLdEvents, taipeiDateTime } from "./html.ts";

export const ACCUPASS_SEARCHES = ["c=music&t=this-week", "c=music&t=next-week", "c=arts&t=this-week", "c=arts&t=next-week"] as const;

export function accupassSearchUrl(query: string): string {
  return `https://www.accupass.com/search?${query}`;
}

export function accupassEventUrl(id: string): string {
  return `https://www.accupass.com/event/${id}`;
}

export interface AccupassItem {
  id: string;
  name: string;
  photoUrl: string | null;
  startDateTime: string;
  endDateTime: string;
  /** 英文城市（Taipei City） */
  location: string;
}

export interface AccupassDetail {
  imageUrl: string | null;
  address: string | null;
  locationName: string | null;
  start: string | null;
  end: string | null;
}

/** 把 self.__next_f.push([1,"…"]) 的字串片段還原、接起來 */
function rscPayload(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)];
  return chunks
    .map(([, literal]) => {
      try {
        return JSON.parse(literal) as string;
      } catch {
        return "";
      }
    })
    .join("");
}

/** 從 `"key":[` 開始配對中括號，取出整個陣列 JSON */
function arrayAfter(payload: string, key: string): unknown[] | null {
  const start = payload.indexOf(`"${key}":[`);
  if (start < 0) return null;
  const open = payload.indexOf("[", start);
  let depth = 0;
  let inString = false;
  for (let index = open; index < payload.length; index += 1) {
    const char = payload[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(payload.slice(open, index + 1));
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** 搜尋頁 → 實體活動（線上、外部連結的不收）；找不到資料丟錯 */
export function parseAccupassSearch(html: string): AccupassItem[] {
  const list = arrayAfter(rscPayload(html), "initialSearchedEvents");
  if (!list) throw new Error("Accupass 搜尋頁找不到 initialSearchedEvents（前端改版？）");
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const id = text(raw.eventIdNumber);
    if (!/^\d{10,40}$/.test(id) || raw.eventPlaceType !== "Offline" || raw.isExternalLink === true) return [];
    return [
      {
        id,
        name: cleanText(raw.name),
        photoUrl: text(raw.photoUrl) || null,
        startDateTime: text(raw.startDateTime),
        endDateTime: text(raw.endDateTime),
        location: text(raw.location),
      },
    ];
  });
}

/** 活動頁 JSON-LD → 地址、場地名、大圖、起訖 */
export function parseAccupassEvent(html: string): AccupassDetail | null {
  const block = jsonLdEvents(html)[0];
  if (!block) return null;
  const location = block.location && typeof block.location === "object" ? (block.location as Record<string, unknown>) : {};
  const address = cleanText(typeof location.address === "string" ? location.address : "") || null;
  return {
    imageUrl: text(block.image) || null,
    address: address ? address.replace(/^台灣/, "") : null,
    locationName: cleanText(location.name) || null,
    start: text(block.startDate) || null,
    end: text(block.endDate) || null,
  };
}

/** 場地名是主辦自填，常是一句話（「附近不好停車，記得早點來」）→ 不像場地就不用 */
export function plausibleVenue(name: string | null): string | null {
  // 括號裡多半是交通說明（「（行天宮捷運站1號出口）」）：拿掉再判斷
  const trimmed = (name ?? "").replace(/[（(][^）)]*[）)]/g, "").trim();
  if (!trimmed) return null;
  if (Array.from(trimmed).length > 30 || /[，。！？!?、]|記得|附近|停車|請|歡迎|對面|捷運|出口|號口/.test(trimmed)) return null;
  return trimmed;
}

export function accupassToEvent(item: AccupassItem, detail: AccupassDetail | null): CollectedEvent | null {
  const start = taipeiDateTime(detail?.start ?? item.startDateTime) ?? taipeiDateTime(item.startDateTime);
  if (!start) return null;
  const end = taipeiDateTime(detail?.end ?? item.endDateTime);
  const url = accupassEventUrl(item.id);
  return buildEvent({
    source: "accupass",
    sourceId: item.id,
    title: item.name,
    fallbackCategory: "performance",
    venue: plausibleVenue(detail?.locationName ?? null),
    city: cityFromAddress(detail?.address) ?? cityFromAddress(item.location),
    startsOn: start.date,
    endsOn: end?.date ?? null,
    showTimes: [{ date: start.date, time: start.time }],
    ticketUrls: [url],
    imageUrl: detail?.imageUrl ?? item.photoUrl,
    sourceUrl: url,
  });
}
