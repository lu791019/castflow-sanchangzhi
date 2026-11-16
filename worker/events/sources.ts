/**
 * 各來源的收集流程（列表 → 需要時抓活動頁 → 解析）。網路走 PoliteFetcher，頁面紀錄走 memo，
 * 單一活動頁失敗只記下來、不擋整個來源；列表本身失敗就整個來源丟錯（collector 警報）。
 * 售票平台與北美館在這支；館方展覽來源在 venues/collectors.ts。
 */

import type { CollectedEvent, EventSource } from "../../src/lib/events/collected.ts";
import { ACCUPASS_SEARCHES, accupassEventUrl, accupassSearchUrl, accupassToEvent, parseAccupassEvent, parseAccupassSearch, type AccupassItem } from "./accupass.ts";
import type { PoliteFetcher } from "./fetcher.ts";
import { KKTIX_CATEGORIES, KKTIX_MAX_PAGES, kktixFeedUrl, kktixToEvent, parseKktixFeed, parseKktixImage, type KktixEntry } from "./kktix.ts";
import { OPENTIX_SITEMAP, parseOpentixEvent, parseOpentixSitemap, type OpentixLink } from "./opentix.ts";
import { isFresh, type PageMemo } from "./state.ts";
import { parseTfamExhibitions, TFAM_ENDPOINT, TFAM_TYPES, tfamRequestBody } from "./tfam.ts";
import { VENUE_COLLECTORS } from "./venues/collectors.ts";

const DAY_MS = 86_400_000;
/** 每天最多抓幾個活動頁（禮貌＋時間）；幾天跑一輪就乘幾倍（capScale），平均每天請求數不變 */
export const DETAIL_CAPS = { kktixImages: 60, opentixPages: 150, accupassPages: 40 } as const;
/** 活動頁多久重抓一次（遠大於「24 小時內不重抓」） */
export const DETAIL_MAX_AGE_MS = 7 * DAY_MS;
/** KKTIX 圖片抓過一次就用 30 天 */
export const IMAGE_MAX_AGE_MS = 30 * DAY_MS;
/** KKTIX 圖片只補 30 天內有檔期的 */
const IMAGE_WINDOW_DAYS = 30;

export interface SourceContext {
  fetcher: PoliteFetcher;
  today: string;
  now: number;
  /** 活動頁上限倍數（= 幾天跑一輪） */
  capScale: number;
  memo(url: string): PageMemo | undefined;
  remember(url: string, memo: PageMemo): void;
}

export interface SourceResult {
  events: CollectedEvent[];
  /** 個別活動頁失敗（不擋整個來源） */
  pageFailures: string[];
}

export type SourceCollector = (context: SourceContext) => Promise<SourceResult>;

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const notEnded = (today: string) => (event: CollectedEvent) => event.endsOn >= today;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function kktixEntries(context: SourceContext, categoryId: number): Promise<KktixEntry[]> {
  const pages: KktixEntry[][] = [];
  for (let page = 1; page <= KKTIX_MAX_PAGES; page += 1) {
    const entries = parseKktixFeed(await context.fetcher.getText(kktixFeedUrl(categoryId, page)));
    if (entries.length === 0) break;
    pages.push(entries);
  }
  return pages.flat();
}

export const collectKktix: SourceCollector = async (context) => {
  const windowEnd = addDays(context.today, IMAGE_WINDOW_DAYS);
  const pageFailures: string[] = [];
  const events: CollectedEvent[] = [];
  let imageBudget = DETAIL_CAPS.kktixImages * context.capScale;
  for (const { id, category } of KKTIX_CATEGORIES) {
    for (const entry of await kktixEntries(context, id)) {
      const draft = kktixToEvent(entry, category, null);
      if (!draft || draft.endsOn < context.today) continue;
      const cached = context.memo(entry.url);
      let image = isFresh(cached, context.now, IMAGE_MAX_AGE_MS) ? (cached.image ?? null) : null;
      if (!isFresh(cached, context.now, IMAGE_MAX_AGE_MS) && draft.startsOn <= windowEnd && imageBudget > 0) {
        imageBudget -= 1;
        try {
          image = parseKktixImage(await context.fetcher.getText(entry.url));
          context.remember(entry.url, { fetchedAt: context.now, endsOn: draft.endsOn, image });
        } catch (error) {
          pageFailures.push(errorText(error));
        }
      }
      events.push({ ...draft, imageUrl: image });
    }
  }
  return { events, pageFailures };
};

/** id 大的（新上架）先抓 */
function byNewest(a: OpentixLink, b: OpentixLink): number {
  const [x, y] = [BigInt(a.id), BigInt(b.id)];
  return x === y ? 0 : x > y ? -1 : 1;
}

export const collectOpentix: SourceCollector = async (context) => {
  const links = parseOpentixSitemap(await context.fetcher.getText(OPENTIX_SITEMAP));
  const due = links
    .filter((link) => {
      const memo = context.memo(link.url);
      if (memo?.endsOn && memo.endsOn < context.today) return false;
      return !isFresh(memo, context.now, DETAIL_MAX_AGE_MS);
    })
    .sort(byNewest)
    .slice(0, DETAIL_CAPS.opentixPages * context.capScale);
  const pageFailures: string[] = [];
  const events: CollectedEvent[] = [];
  for (const link of due) {
    try {
      const event = parseOpentixEvent(await context.fetcher.getText(link.url), link);
      // 影展、課程、解析不到的也記下來，7 天內不重抓
      context.remember(link.url, { fetchedAt: context.now, endsOn: event?.endsOn ?? null });
      if (event) events.push(event);
    } catch (error) {
      pageFailures.push(errorText(error));
    }
  }
  return { events: events.filter(notEnded(context.today)), pageFailures };
};

export const collectAccupass: SourceCollector = async (context) => {
  const lists: AccupassItem[][] = [];
  for (const query of ACCUPASS_SEARCHES) lists.push(parseAccupassSearch(await context.fetcher.getText(accupassSearchUrl(query))));
  const items = [...new Map(lists.flat().map((item) => [item.id, item])).values()];
  const pageFailures: string[] = [];
  const events: CollectedEvent[] = [];
  let budget = DETAIL_CAPS.accupassPages * context.capScale;
  for (const item of items) {
    // 先用列表資料判斷：課程、已結束的不抓活動頁
    const draft = accupassToEvent(item, null);
    if (!draft || draft.endsOn < context.today) continue;
    const url = accupassEventUrl(item.id);
    const cached = context.memo(url);
    let detail = isFresh(cached, context.now, DETAIL_MAX_AGE_MS) ? (cached.detail ?? null) : null;
    if (!isFresh(cached, context.now, DETAIL_MAX_AGE_MS) && budget > 0) {
      budget -= 1;
      try {
        detail = parseAccupassEvent(await context.fetcher.getText(url));
        context.remember(url, { fetchedAt: context.now, endsOn: draft.endsOn, detail });
      } catch (error) {
        pageFailures.push(errorText(error));
      }
    }
    const event = accupassToEvent(item, detail);
    if (event && event.endsOn >= context.today) events.push(event);
  }
  return { events, pageFailures };
};

export const collectTfam: SourceCollector = async (context) => {
  const lists: CollectedEvent[][] = [];
  for (const type of TFAM_TYPES) lists.push(parseTfamExhibitions(await context.fetcher.postJson(TFAM_ENDPOINT, tfamRequestBody(type))));
  const events = [...new Map(lists.flat().map((event) => [event.sourceId, event])).values()];
  return { events: events.filter(notEnded(context.today)), pageFailures: [] };
};

export const SOURCE_COLLECTORS: Record<EventSource, SourceCollector> = {
  kktix: collectKktix,
  opentix: collectOpentix,
  accupass: collectAccupass,
  tfam: collectTfam,
  ...VENUE_COLLECTORS,
};
