/**
 * KKTIX（純函式）：官方 Atom feed `kktix.com/events.atom?category_id=4（演出）／11（展覽）`，每頁 100 筆。
 * content 是「時間：2026/10/09 19:30(+0800) ~ 2026/10/25 14:30(+0800)\n地點：水源劇場 / 臺北市中正區…」。
 * feed 沒圖：圖片另抓活動頁 og:image（collector 控制次數）。`kktix.com/events`、`events.json`、sitemap 在 Cloudflare 驗證後，不碰。
 */

import { XMLParser } from "fast-xml-parser";
import { cityFromAddress, type CollectedEvent, type EventCategory } from "../../src/lib/events/collected.ts";
import { buildEvent } from "./build.ts";
import { cleanText, ogImage, slashDateTime } from "./html.ts";

export const KKTIX_FEED = "https://kktix.com/events.atom";
export const KKTIX_CATEGORIES = [
  { id: 4, category: "performance" },
  { id: 11, category: "exhibition" },
] as const satisfies ReadonlyArray<{ id: number; category: EventCategory }>;
/** 演出約 5–7 頁；保險上限 */
export const KKTIX_MAX_PAGES = 10;

export function kktixFeedUrl(categoryId: number, page: number): string {
  return `${KKTIX_FEED}?category_id=${categoryId}${page > 1 ? `&page=${page}` : ""}`;
}

export interface KktixEntry {
  id: string;
  url: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  time: string | null;
  venue: string | null;
  address: string | null;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false });

function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "#text" in node) return String((node as { "#text": unknown })["#text"] ?? "");
  return "";
}

function hrefOf(link: unknown): string {
  const links = Array.isArray(link) ? link : [link];
  const alternate = links.find((item) => item && typeof item === "object" && (item as Record<string, unknown>)["@_rel"] === "alternate");
  const href = alternate ? (alternate as Record<string, unknown>)["@_href"] : undefined;
  return typeof href === "string" ? href : "";
}

/** 「時間：…」「地點：場地 / 地址」 */
function parseContent(content: string): Pick<KktixEntry, "startsOn" | "endsOn" | "time" | "venue" | "address"> | null {
  const timeLine = /時間：([^\n]*)/.exec(content)?.[1] ?? "";
  const [startText, endText = ""] = timeLine.split("~");
  const start = slashDateTime(startText);
  if (!start) return null;
  const end = slashDateTime(endText);
  const placeLine = cleanText(/地點：([^\n]*)/.exec(content)?.[1] ?? "");
  const [rawVenue, ...rest] = placeLine.split(" / ");
  const venue = rawVenue && rawVenue !== "依各場次" && !/^線上/.test(rawVenue) ? rawVenue : null;
  const address = rest.join(" / ").trim() || null;
  return { startsOn: start.date, endsOn: end?.date ?? null, time: start.time, venue, address };
}

/** 一頁 Atom → 條目；格式壞掉丟錯（collector 會警報），單筆壞掉跳過 */
export function parseKktixFeed(xml: string): KktixEntry[] {
  const data = parser.parse(xml) as { feed?: { entry?: unknown } };
  if (!data.feed) throw new Error("KKTIX feed 格式不對（沒有 <feed>）");
  const entries = data.feed.entry === undefined ? [] : Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    // tag:kktix.com,2005:Event/126170 或 CollectionEvent/125546（系列活動）：兩種編號各自獨立，前綴保留
    const tag = /(\w*Event)\/(\d+)/.exec(textOf(raw.id));
    const id = tag ? `${tag[1]}-${tag[2]}` : null;
    const url = hrefOf(raw.link);
    const title = cleanText(textOf(raw.title));
    const content = parseContent(textOf(raw.content));
    if (!id || !url || !title || !content) return [];
    return [{ id, url, title, ...content }];
  });
}

export function kktixToEvent(entry: KktixEntry, category: EventCategory, imageUrl: string | null): CollectedEvent | null {
  return buildEvent({
    source: "kktix",
    sourceId: entry.id,
    title: entry.title,
    fallbackCategory: category,
    venue: entry.venue,
    city: cityFromAddress(entry.address) ?? cityFromAddress(entry.venue),
    startsOn: entry.startsOn,
    endsOn: entry.endsOn,
    showTimes: [{ date: entry.startsOn, time: entry.time }],
    // KKTIX 活動頁就是售票頁（我們只連過去，不碰購票流程）
    ticketUrls: [entry.url],
    imageUrl,
    sourceUrl: entry.url,
  });
}

/** 活動頁 → 圖片（og:image） */
export function parseKktixImage(html: string): string | null {
  return ogImage(html);
}
