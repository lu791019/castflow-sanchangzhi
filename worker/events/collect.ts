/**
 * 多來源藝文活動收集一輪：各來源平行（各站內部照禮貌間隔序列）→ 每個來源各自送 POST /api/events/ingest。
 * 某來源整個失敗、0 筆、或活動頁失敗過半都推 warn 警報，不影響其他來源。每 N 天跑一次（台北日期，預設 7），狀態存本機檔。
 * 整輪全部失敗不算跑過（隔天再試）；來源送進 app 失敗，這輪記下的頁面也不留（下一輪重抓）。
 */

import { EVENT_SOURCES, type CollectedEvent, type EventSource } from "../../src/lib/events/collected.ts";
import { taipeiDateKey } from "../../src/lib/journal/time.ts";
import type { Notify } from "../notify.ts";
import type { PoliteFetcher } from "./fetcher.ts";
import type { SourceCollector } from "./sources.ts";
import { pruneState, type EventsState, type PageMemo } from "./state.ts";

export interface IngestSummary {
  received: number;
  upserted: number;
  invalid: number;
  merged: number;
  pruned: number;
}

export interface CollectDeps {
  fetcher: PoliteFetcher;
  collectors: Record<EventSource, SourceCollector>;
  ingest(source: EventSource, events: CollectedEvent[]): Promise<IngestSummary>;
  notify: Notify;
  log(line: string): void;
  now(): number;
  /** 只跑這些來源；不給就全部都跑 */
  sources?: readonly EventSource[];
  /** 活動頁上限倍數（幾天跑一輪）；不給就 1 */
  capScale?: number;
}

export interface SourceReport {
  source: EventSource;
  ok: boolean;
  collected: number;
  pageFailures: number;
  ingest: IngestSummary | null;
  error: string | null;
}

const DAY_MS = 86_400_000;

/** 距上次成功跑（台北日期）滿 intervalDays 天才跑；沒跑過就跑；今天試過就不再試 */
export function shouldCollect(state: EventsState, now: Date, intervalDays: number): boolean {
  const today = taipeiDateKey(now);
  if (state.lastAttemptDay === today) return false;
  if (!state.lastRunDay) return true;
  const elapsedDays = (Date.parse(today) - Date.parse(state.lastRunDay)) / DAY_MS;
  return Number.isNaN(elapsedDays) || elapsedDays >= intervalDays;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runSource(
  source: EventSource,
  deps: CollectDeps,
  context: { today: string; now: number; capScale: number },
  pages: Map<string, PageMemo>,
): Promise<SourceReport> {
  const remembered = new Map<string, PageMemo>();
  try {
    const result = await deps.collectors[source]({
      fetcher: deps.fetcher,
      ...context,
      memo: (url: string) => remembered.get(url) ?? pages.get(url),
      remember: (url: string, memo: PageMemo) => void remembered.set(url, memo),
    });
    const failedMost = result.pageFailures.length > 0 && result.pageFailures.length >= result.events.length;
    if (failedMost) {
      await deps.notify("warn", `藝文活動收集：${source} 活動頁多數抓不到（${result.pageFailures.length} 頁）`, result.pageFailures.slice(0, 5).join("\n"));
    }
    if (result.events.length === 0) {
      await deps.notify("warn", `藝文活動收集：${source} 這輪 0 筆`, "列表讀得到但沒有可收的活動，可能網站改版或過濾太嚴");
    }
    const ingest = await deps.ingest(source, result.events);
    for (const [url, memo] of remembered) pages.set(url, memo);
    return { source, ok: true, collected: result.events.length, pageFailures: result.pageFailures.length, ingest, error: null };
  } catch (error) {
    const detail = errorText(error);
    await deps.notify("warn", `藝文活動收集：${source} 失敗（這個來源今天先跳過）`, detail);
    return { source, ok: false, collected: 0, pageFailures: 0, ingest: null, error: detail };
  }
}

/** 跑一輪；回傳新的狀態（呼叫端負責存檔）與各來源報告 */
export async function collectEvents(state: EventsState, deps: CollectDeps): Promise<{ state: EventsState; reports: SourceReport[] }> {
  const startedAt = deps.now();
  const today = taipeiDateKey(new Date(startedAt));
  const pages = new Map(Object.entries(state.pages));
  const context = { today, now: startedAt, capScale: deps.capScale ?? 1 };
  const reports = await Promise.all((deps.sources ?? EVENT_SOURCES).map((source) => runSource(source, deps, context, pages)));
  for (const report of reports) {
    deps.log(
      report.ok
        ? `藝文活動 ${report.source}：收 ${report.collected} 筆、寫入 ${report.ingest?.upserted ?? 0}、無效 ${report.ingest?.invalid ?? 0}、合併售票 ${report.ingest?.merged ?? 0}、清舊 ${report.ingest?.pruned ?? 0}、活動頁失敗 ${report.pageFailures}`
        : `藝文活動 ${report.source}：失敗 ${report.error}`,
    );
  }
  deps.log(`藝文活動請求數：${JSON.stringify(deps.fetcher.counts())}`);
  const lastRunDay = reports.some((report) => report.ok) ? today : state.lastRunDay;
  const next = pruneState({ lastRunDay, lastAttemptDay: today, pages: Object.fromEntries(pages) }, startedAt);
  return { state: next, reports };
}
