/**
 * 臺灣當代文化實驗場 C-LAB（純函式）：`/zh/events/`（轉到 /events）是 Next.js 頁，活動資料在 RSC 酬載
 * `self.__next_f.push([1,"…"])` 裡的 `"initialEvents":[…]`（約 300 筆，含過去活動）：
 * `{ title, slug, eventTypes: { nodes: [{ slug }] }, featuredImage, singleEvent: { coverImage, date: { start, end }, location } }`。
 * 只收展覽與演出（講座、工作坊、論壇、導覽、讀書會不收）；在國外的合作展不收。robots.txt 只禁 /api/ 等，頁面可抓。
 */

import type { CollectedEvent, EventCategory } from "../../../src/lib/events/collected.ts";
import { cleanText, taipeiDateTime } from "../html.ts";
import { OVERSEAS } from "../tfam.ts";
import { absoluteUrl, uniqueBySourceId, venueEvent, venueTitle } from "./common.ts";

export const CLAB_EVENTS_URL = "https://clab.org.tw/zh/events/";
const SITE = "https://clab.org.tw/";
const EXHIBITION_TYPES = new Set(["exhibition", "exhibitions"]);
const PERFORMANCE_TYPES = new Set(["performance"]);

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw => (value && typeof value === "object" ? (value as Raw) : {});

/** 頁面裡所有 RSC 字串接起來（資料可能被拆在好幾個 push 裡） */
function rscText(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)].flatMap(([, body]) => {
    try {
      const data: unknown = JSON.parse(body);
      return Array.isArray(data) && typeof data[1] === "string" ? [data[1]] : [];
    } catch {
      return [];
    }
  });
  return chunks.join("");
}

/** 從 start（"["）找到對應的 "]"：略過字串裡的括號與跳脫字元 */
function matchingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "[" || char === "{") depth += 1;
    else if (char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function initialEvents(html: string): Raw[] {
  const text = rscText(html);
  const key = '"initialEvents":';
  const at = text.indexOf(key);
  const end = at < 0 ? -1 : matchingBracket(text, at + key.length);
  if (end < 0) throw new Error("C-LAB 活動頁找不到 initialEvents（版型可能改了）");
  try {
    const list: unknown = JSON.parse(text.slice(at + key.length, end + 1));
    return Array.isArray(list) ? list.map(record) : [];
  } catch {
    throw new Error("C-LAB initialEvents 不是合法 JSON");
  }
}

function categoryOf(raw: Raw): EventCategory | null {
  const nodes = record(raw.eventTypes).nodes;
  const types = Array.isArray(nodes) ? nodes.map((node) => String(record(node).slug ?? "")) : [];
  if (types.some((type) => EXHIBITION_TYPES.has(type))) return "exhibition";
  if (types.some((type) => PERFORMANCE_TYPES.has(type))) return "performance";
  return null;
}

const imageOf = (value: unknown) => absoluteUrl(record(record(value).node).sourceUrl, SITE);

function toEvent(raw: Raw): CollectedEvent | null {
  const category = categoryOf(raw);
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  const single = record(raw.singleEvent);
  const location = cleanText(single.location);
  if (!category || !slug || OVERSEAS.test(location)) return null;
  const date = record(single.date);
  const startsOn = taipeiDateTime(date.start)?.date ?? null;
  // 單日演出常沒寫結束日；展覽沒有結束日就不收
  const endsOn = taipeiDateTime(date.end)?.date ?? (category === "performance" ? startsOn : null);
  return venueEvent({
    source: "clab",
    sourceId: slug,
    title: venueTitle(raw.title),
    venue: "臺灣當代文化實驗場",
    city: "臺北市",
    startsOn,
    endsOn,
    imageUrl: imageOf(single.coverImage) ?? imageOf(raw.featuredImage),
    sourceUrl: `${SITE}events/${encodeURIComponent(slug)}`,
    category,
  });
}

/** 活動頁 → 展覽與演出（含已結束的，收集流程再濾）；找不到資料丟錯 */
export function parseClabEvents(html: string): CollectedEvent[] {
  const events = initialEvents(html).flatMap((raw) => {
    const event = toEvent(raw);
    return event ? [event] : [];
  });
  return uniqueBySourceId(events);
}
