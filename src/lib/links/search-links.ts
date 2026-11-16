/**
 * 搜尋連結法（Q-33 A，不自爬）：帶作品名跳到各站的搜尋頁。venue_type 決定排序與前兩顆。
 *
 * 2026-10-13 逐站實測（真瀏覽器 Playwright＋curl，關鍵字「音樂會」「落日飛車」）：
 * - KKTIX    https://kktix.com/events?search=<q>            → 200，結果頁含關鍵字（curl 會被 Cloudflare 擋，瀏覽器正常）
 * - OPENTIX  https://www.opentix.life/search/<q>            → 200，「找到 389 個項目」；`?q=`／`?keyword=` 不帶入關鍵字，不能用
 * - Accupass https://www.accupass.com/search?q=<q>          → 200，「搜尋音樂會相關活動」
 * - KKday    https://www.kkday.com/zh-tw/product/productlist?keyword=<q> → 200，「音樂會精選商品」
 * - 拓元     站內搜尋是 /activity/list/search/<q>，但直接開會 301 回首頁；/activity/search?q= 不帶入關鍵字
 *            → 不通，改用 Google `site:tixcraft.com`
 * - Klook    /zh-TW/search/result/?query=<q> 對自動化回 403（機器人防護）→ 不保證，改用 Google `site:klook.com`
 * - 官網     Google「名稱 官網」
 * - 影劇     JustWatch https://www.justwatch.com/tw/search?q=<q> → 200（`/tw/搜尋` 是 404）
 */

import type { VenueType } from "@/lib/venue/venue-type";
import type { WorkKind } from "@/lib/works/format";
import type { LinkKind, WorkLink } from "./types";

export type TicketSiteId = "kktix" | "tixcraft" | "opentix" | "accupass" | "klook" | "kkday" | "official";

interface SiteSpec {
  kind: LinkKind;
  label: string;
  build: (query: string) => string;
}

const SEARCH_NOTE = "搜尋";
const enc = encodeURIComponent;

export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${enc(query)}`;
}

const SITES: Record<TicketSiteId, SiteSpec> = {
  kktix: { kind: "ticket", label: "KKTIX", build: (q) => `https://kktix.com/events?search=${enc(q)}` },
  tixcraft: { kind: "ticket", label: "拓元", build: (q) => googleSearchUrl(`${q} site:tixcraft.com`) },
  opentix: { kind: "ticket", label: "OPENTIX", build: (q) => `https://www.opentix.life/search/${enc(q)}` },
  accupass: { kind: "ticket", label: "Accupass", build: (q) => `https://www.accupass.com/search?q=${enc(q)}` },
  klook: { kind: "ticket", label: "Klook", build: (q) => googleSearchUrl(`${q} site:klook.com`) },
  kkday: { kind: "ticket", label: "KKday", build: (q) => `https://www.kkday.com/zh-tw/product/productlist?keyword=${enc(q)}` },
  official: { kind: "official", label: "官網", build: (q) => googleSearchUrl(`${q} 官網`) },
};

const LIVE_ORDER: Record<string, TicketSiteId[]> = {
  concert_hall: ["opentix", "kktix", "tixcraft"],
  theater: ["opentix", "kktix", "tixcraft"],
  livehouse: ["kktix", "accupass", "tixcraft"],
  festival: ["kktix", "accupass", "tixcraft"],
  arena: ["tixcraft", "kktix", "opentix"],
  default: ["kktix", "tixcraft", "opentix", "accupass"],
};

const EXHIBITION_ORDER: Record<string, TicketSiteId[]> = {
  museum: ["official", "klook", "kkday"],
  history_museum: ["official", "klook", "kkday"],
  gallery: ["official", "accupass"],
  special: ["klook", "kkday", "kktix", "official"],
  default: ["official", "klook", "kkday", "accupass"],
};

/** 演出／展覽的售票站排序；前兩顆是畫面上的主要按鈕 */
export function ticketSiteOrder(kind: "live" | "exhibition", venueType: VenueType | null): TicketSiteId[] {
  const table = kind === "live" ? LIVE_ORDER : EXHIBITION_ORDER;
  return table[venueType ?? "default"] ?? table.default;
}

/** 搜尋字：合併空白；拓元／OPENTIX 的路徑式搜尋不收斜線與句點，一律換成空白 */
export function cleanQuery(title: string): string {
  return title.replace(/[/.\\]/g, " ").replace(/\s+/g, " ").trim();
}

function searchLink(source: string, spec: SiteSpec, query: string): WorkLink {
  return { kind: spec.kind, source, label: spec.label, url: spec.build(query), origin: "search", note: SEARCH_NOTE };
}

export interface SearchLinkInput {
  kind: WorkKind;
  venueType: VenueType | null;
  title: string;
  /** 電影正在上映：多一顆「查場次」 */
  inTheaters?: boolean;
}

export function buildSearchLinks({ kind, venueType, title, inTheaters = false }: SearchLinkInput): WorkLink[] {
  const query = cleanQuery(title);
  if (!query) return [];
  if (kind === "live" || kind === "exhibition") {
    return ticketSiteOrder(kind, venueType).map((id) => searchLink(id, SITES[id], query));
  }
  if (kind !== "movie" && kind !== "series") return [];
  const justwatch = searchLink(
    "justwatch",
    { kind: "watch", label: "JustWatch", build: (q) => `https://www.justwatch.com/tw/search?q=${enc(q)}` },
    query,
  );
  if (kind !== "movie" || !inTheaters) return [justwatch];
  // 查場次連到開眼（Q-67、Q-76）：開眼站內搜尋只收 POST 表單、GET 帶不出結果（10/26 實測），
  // 改用 Google 限定開眼站內，第一筆就是該片的開眼頁（含各影城時刻表）。只放連結，不抓開眼資料。
  const showtimes = searchLink(
    "showtimes-search",
    { kind: "ticket", label: "查場次", build: (q) => googleSearchUrl(`${q} 時刻表 site:atmovies.com.tw`) },
    query,
  );
  return [showtimes, justwatch];
}
