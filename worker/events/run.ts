/**
 * 藝文活動收集的接線（常駐 worker 與 npm run worker:events 共用）：讀狀態檔 → 距上次滿間隔天數（或強制）就跑一輪 → 存狀態。
 * 常駐 worker 不等它跑完（約 3 分鐘），同一時間只跑一輪。
 */

import { taipeiDateKey } from "../../src/lib/journal/time.ts";
import type { AppApi } from "../api.ts";
import type { Notify } from "../notify.ts";
import type { EventSource } from "../../src/lib/events/collected.ts";
import { collectEvents, shouldCollect, type SourceReport } from "./collect.ts";
import { createPoliteFetcher } from "./fetcher.ts";
import { SOURCE_COLLECTORS } from "./sources.ts";
import { loadState, saveState } from "./state.ts";

export interface EventsRunDeps {
  api: Pick<AppApi, "ingestEvents">;
  notify: Notify;
  log(line: string): void;
  statePath: string;
  intervalDays: number;
  sources: readonly EventSource[];
}

/** 跑一輪；force 時不看上次什麼時候跑。回 null 表示還沒到下一輪 */
export async function runEventsCollection(deps: EventsRunDeps, force = false): Promise<SourceReport[] | null> {
  const state = await loadState(deps.statePath);
  if (!force && !shouldCollect(state, new Date(), deps.intervalDays)) return null;
  deps.log(`藝文活動收集開始（${deps.sources.join("、")}）`);
  // 先記下今天試過，避免中途當掉後每分鐘重跑；失敗已逐來源警報，可手動 npm run worker:events 補
  await saveState(deps.statePath, { ...state, lastAttemptDay: taipeiDateKey(new Date()) });
  const { state: next, reports } = await collectEvents(state, {
    fetcher: createPoliteFetcher({ fetch }),
    collectors: SOURCE_COLLECTORS,
    ingest: (source, events) => deps.api.ingestEvents(source, events),
    notify: deps.notify,
    log: deps.log,
    now: Date.now,
    sources: deps.sources,
    capScale: deps.intervalDays,
  });
  await saveState(deps.statePath, next);
  return reports;
}

let running: Promise<unknown> | null = null;

/** 常駐 worker 每輪呼叫：不阻塞轉錄與提醒；上一輪還在跑就跳過 */
export function startDailyEventsCollection(deps: EventsRunDeps): void {
  if (running) return;
  running = runEventsCollection(deps)
    .catch((error: unknown) =>
      deps.notify("warn", "藝文活動收集整輪失敗", error instanceof Error ? error.message : String(error)).catch(() => undefined),
    )
    .finally(() => {
      running = null;
    });
}
