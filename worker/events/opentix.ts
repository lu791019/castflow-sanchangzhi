/**
 * OPENTIX 兩廳院（純函式）：官方 sitemap `otWebSitemap.xml` 列出 `/event/<id>`，活動頁 JSON-LD 每個場次一個 Event
 * （startDate／endDate 是台北牆上時間、location.name、location.address.addressLocality、image、offers.url）。
 * 頁面沒有類別欄位 → 用標題推；影展場次不收。
 */

import { XMLParser } from "fast-xml-parser";
import { cityFromAddress, type CollectedEvent, type ShowTime } from "../../src/lib/events/collected.ts";
import { buildEvent } from "./build.ts";
import { cleanText, jsonLdEvents, ogImage, taipeiDateTime } from "./html.ts";

export const OPENTIX_SITEMAP = "https://www.opentix.life/otWebSitemap.xml";
const EVENT_URL = /^https:\/\/www\.opentix\.life\/event\/(\d{6,30})$/;

export interface OpentixLink {
  id: string;
  url: string;
}

const parser = new XMLParser({ parseTagValue: false });

/** sitemap → 活動頁網址（只留 /event/<id>，文章、套票、商品不收）；格式壞掉丟錯 */
export function parseOpentixSitemap(xml: string): OpentixLink[] {
  const data = parser.parse(xml) as { urlset?: { url?: unknown } };
  if (!data.urlset) throw new Error("OPENTIX sitemap 格式不對（沒有 <urlset>）");
  const urls = data.urlset.url === undefined ? [] : Array.isArray(data.urlset.url) ? data.urlset.url : [data.urlset.url];
  const links = urls.flatMap((item) => {
    const loc = item && typeof item === "object" ? String((item as Record<string, unknown>).loc ?? "").trim() : "";
    const id = EVENT_URL.exec(loc)?.[1];
    return id ? [{ id, url: loc }] : [];
  });
  return [...new Map(links.map((link) => [link.id, link])).values()];
}

interface Session {
  start: { date: string; time: string | null };
  endDate: string;
  venue: string | null;
  city: string | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sessionOf(block: Record<string, unknown>): Session | null {
  const start = taipeiDateTime(block.startDate);
  if (!start) return null;
  const end = taipeiDateTime(block.endDate);
  const location = record(block.location);
  const address = record(location.address);
  return {
    start,
    endDate: end && end.date > start.date ? end.date : start.date,
    venue: cleanText(location.name) || null,
    city: cityFromAddress(cleanText(address.addressLocality)) ?? cityFromAddress(cleanText(address.streetAddress)),
  };
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/** 活動頁 → 活動（場次照時間排）；沒有 Event JSON-LD 回 null */
export function parseOpentixEvent(html: string, link: OpentixLink): CollectedEvent | null {
  const blocks = jsonLdEvents(html);
  const sessions = blocks.flatMap((block) => {
    const one = sessionOf(block);
    return one ? [one] : [];
  });
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => `${a.start.date}${a.start.time ?? ""}`.localeCompare(`${b.start.date}${b.start.time ?? ""}`));
  const first = sorted[0];
  const showTimes: ShowTime[] = sorted.map((session) => ({ date: session.start.date, time: session.start.time }));
  const lead = blocks[0];
  const offers = Array.isArray(lead.offers) ? record(lead.offers[0]) : record(lead.offers);
  return buildEvent({
    source: "opentix",
    sourceId: link.id,
    title: String(lead.name ?? ""),
    fallbackCategory: "performance",
    venue: first.venue,
    city: first.city,
    startsOn: first.start.date,
    endsOn: sorted.reduce((latest, session) => (session.endDate > latest ? session.endDate : latest), first.endDate),
    showTimes,
    ticketUrls: [firstString(offers.url, lead.url) ?? link.url],
    imageUrl: firstString(lead.image) ?? ogImage(html),
    sourceUrl: link.url,
  });
}
