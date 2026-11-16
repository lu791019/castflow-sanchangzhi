/**
 * 館方展覽來源的收集流程（列表 → 需要時抓明細頁 → 解析）：每輪每站 1–4 次請求，網路走 PoliteFetcher。
 * 列表本身失敗就整個來源丟錯（collector 警報）；臺博館明細頁個別失敗只記下來。已結束的不送。
 */

import type { CollectedEvent } from "../../../src/lib/events/collected.ts";
import type { SourceCollector, SourceContext, SourceResult } from "../sources.ts";
import { isFresh } from "../state.ts";
import { parseClabEvents, CLAB_EVENTS_URL } from "./clab.ts";
import { CMS_SITES, cmsToEvent, needsDetail, parseCmsList, parseCultureDetail, type CmsItem, type CmsSite, type CmsSource } from "./cms.ts";
import { notEndedBy, startedTooLongAgo, uniqueBySourceId } from "./common.ts";
import { KDMOFA_URL, parseKdmofaPage } from "./kdmofa.ts";
import { MOCA_PAGES, parseMocaPage } from "./moca.ts";
import { nstmPageUrl, nstmToEvent, NSTM_MAX_PAGES, parseNstmPage, type NstmRow } from "./nstm.ts";
import { NMMBA_URL, NMNS_URL, parseNmmbaExhibitions, parseNmnsExhibitions } from "./opendata.ts";
import { parseSongshanPage, songshanPageUrl, SONGSHAN_MAX_PAGES } from "./songshan.ts";
import { parseTnamPage, TNAM_PAGES } from "./tnam.ts";

const DAY_MS = 86_400_000;
/** 臺博館明細頁每輪最多抓幾頁 */
export const VENUE_DETAIL_CAP = 12;
/** 明細頁（展期）抓過一次就用 30 天：展期很少改，且遠大於「7 天不重抓」 */
export const VENUE_DETAIL_MAX_AGE_MS = 30 * DAY_MS;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function finish(context: SourceContext, events: readonly CollectedEvent[], pageFailures: string[] = []): SourceResult {
  return { events: uniqueBySourceId(events).filter(notEndedBy(context.today)), pageFailures };
}

/** 一個或幾個固定網址，各自解析後合併 */
function fixedPages(urls: readonly string[], parse: (text: string) => CollectedEvent[]): SourceCollector {
  return async (context) => {
    const lists: CollectedEvent[][] = [];
    for (const url of urls) lists.push(parse(await context.fetcher.getText(url)));
    return finish(context, lists.flat());
  };
}

export const collectSongshan: SourceCollector = async (context) => {
  const first = parseSongshanPage(await context.fetcher.getText(songshanPageUrl(1)));
  const lists = [first.events];
  for (let page = 2; page <= Math.min(first.pages, SONGSHAN_MAX_PAGES); page += 1) {
    lists.push(parseSongshanPage(await context.fetcher.getText(songshanPageUrl(page))).events);
  }
  return finish(context, lists.flat());
};

/** 科工館依開始日排（常設在前）：抓第 1 頁知道總頁數，再從最後一頁往前，翻到出現常設或太早開始的就停 */
export const collectNstm: SourceCollector = async (context) => {
  const first = parseNstmPage(await context.fetcher.getText(nstmPageUrl(1)));
  const rows: NstmRow[] = [...first.rows];
  for (let page = first.lastPage, fetched = 1; page >= 2 && fetched < NSTM_MAX_PAGES; page -= 1, fetched += 1) {
    const { rows: pageRows } = parseNstmPage(await context.fetcher.getText(nstmPageUrl(page)));
    rows.push(...pageRows);
    if (pageRows.some((row) => startedTooLongAgo(row.startsOn, context.today))) break;
  }
  return finish(context, rows.flatMap((row) => nstmToEvent(row) ?? []));
};

/** 臺博館列表沒日期：明細頁補起訖（30 天內抓過用 memo；已結束的不再抓；每輪上限） */
async function withDates(context: SourceContext, items: readonly CmsItem[], failures: string[], budget: { left: number }): Promise<CmsItem[]> {
  const dated: CmsItem[] = [];
  for (const item of items) {
    if (!needsDetail(item)) {
      dated.push(item);
      continue;
    }
    const cached = context.memo(item.url);
    const fresh = isFresh(cached, context.now, VENUE_DETAIL_MAX_AGE_MS);
    const ended = !!cached?.endsOn && cached.endsOn < context.today;
    if (cached && (fresh || ended)) {
      dated.push({ ...item, startsOn: cached.startsOn ?? null, endsOn: cached.endsOn ?? null });
      continue;
    }
    if (budget.left <= 0) continue;
    budget.left -= 1;
    try {
      const dates = parseCultureDetail(await context.fetcher.getText(item.url));
      context.remember(item.url, { fetchedAt: context.now, startsOn: dates?.startsOn ?? null, endsOn: dates?.endsOn ?? null });
      dated.push({ ...item, startsOn: dates?.startsOn ?? null, endsOn: dates?.endsOn ?? null });
    } catch (error) {
      failures.push(errorText(error));
    }
  }
  return dated;
}

function collectCms(site: CmsSite): SourceCollector {
  return async (context) => {
    const failures: string[] = [];
    const budget = { left: VENUE_DETAIL_CAP };
    const events: CollectedEvent[] = [];
    for (const list of site.lists) {
      const items = parseCmsList(await context.fetcher.getText(list.url), site.source);
      for (const item of await withDates(context, items, failures, budget)) {
        const event = cmsToEvent(site, list, item);
        if (event) events.push(event);
      }
    }
    return finish(context, events, failures);
  };
}

const cms = (source: CmsSource) => collectCms(CMS_SITES[source]);

export const VENUE_COLLECTORS = {
  nmns: fixedPages([NMNS_URL], parseNmnsExhibitions),
  nmmba: fixedPages([NMMBA_URL], parseNmmbaExhibitions),
  songshan: collectSongshan,
  nstm: collectNstm,
  tnam: fixedPages(TNAM_PAGES, parseTnamPage),
  ntm: cms("ntm"),
  nmh: cms("nmh"),
  cksmh: cms("cksmh"),
  clab: fixedPages([CLAB_EVENTS_URL], parseClabEvents),
  moca: fixedPages(MOCA_PAGES, parseMocaPage),
  kdmofa: fixedPages([KDMOFA_URL], parseKdmofaPage),
} satisfies Record<string, SourceCollector>;
