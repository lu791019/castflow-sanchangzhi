/**
 * 北美館 TFAM（純函式）：官網展覽頁自己呼叫的 `POST /ashx/Exhibition.ashx`（JJMethod GetEx，Type 1 現正展出、2 即將展出），
 * 回 `{ Status: "1", Data: [{ ExID, ExName, BeginDate: "2026/09/12", EndDate, Area, NowPlayImg, IsSpecial, ShowStyle, ExternalLink }] }`。
 * 海外展（威尼斯雙年展台灣館等）不收；美術館現場購票，ticket_urls 留空，卡片連活動頁。
 */

import type { CollectedEvent } from "../../src/lib/events/collected.ts";
import { buildEvent } from "./build.ts";
import { cleanText, slashDateTime } from "./html.ts";

export const TFAM_ENDPOINT = "https://www.tfam.museum/ashx/Exhibition.ashx?ddlLang=zh-tw";
export const TFAM_TYPES = ["1", "2"] as const;
export const TFAM_VENUE = "臺北市立美術館";
const SITE = "https://www.tfam.museum";
/** 海外展（威尼斯雙年展台灣館、館方在國外的合作展）：場地不在台灣，不收 */
export const OVERSEAS = /義大利|威尼斯|海外|國外|日本|韓國|德國|法國|英國|美國|澳洲|香港/;

export function tfamRequestBody(type: (typeof TFAM_TYPES)[number]): string {
  return JSON.stringify({ JJMethod: "GetEx", Type: type });
}

type Raw = Record<string, unknown>;
/** ExID、IsSpecial、ShowStyle 是數字，其他是字串 */
const text = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "");

function imageOf(path: string): string | null {
  if (!path) return null;
  const clean = path.replaceAll("\\", "/").replace(/^\/+/, "");
  return encodeURI(`${SITE}/File/${clean}`);
}

function pageOf(raw: Raw, id: string): string {
  const external = text(raw.ExternalLink);
  if (text(raw.ShowStyle) === "2" && /^https:\/\/.+\..+/.test(external)) return external;
  const page = text(raw.IsSpecial) === "1" ? "Exhibition_Special.aspx" : "Exhibition_page.aspx";
  return `${SITE}/Exhibition/${page}?ddlLang=zh-tw&id=${encodeURIComponent(id)}`;
}

/** 回應 → 展覽；Status 不是 1 或格式不對丟錯 */
export function parseTfamExhibitions(data: unknown): CollectedEvent[] {
  const body = data && typeof data === "object" ? (data as Raw) : {};
  if (String(body.Status) !== "1" || !Array.isArray(body.Data)) {
    throw new Error(`北美館展覽回應格式不對（Status=${String(body.Status)}）`);
  }
  return body.Data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Raw;
    const id = text(raw.ExID);
    const area = cleanText(raw.Area);
    const start = slashDateTime(text(raw.BeginDate));
    if (!id || !start || OVERSEAS.test(area)) return [];
    const end = slashDateTime(text(raw.EndDate));
    const event = buildEvent({
      source: "tfam",
      sourceId: id,
      title: text(raw.ExName),
      fallbackCategory: "exhibition",
      venue: TFAM_VENUE,
      city: "臺北市",
      startsOn: start.date,
      endsOn: end?.date ?? null,
      showTimes: [],
      ticketUrls: [],
      imageUrl: imageOf(text(raw.NowPlayImg)),
      sourceUrl: pageOf(raw, id),
    });
    // 美術館的展覽一律算展覽（標題沒有「展」字也是）
    return event ? [{ ...event, category: "exhibition" as const }] : [];
  });
}
