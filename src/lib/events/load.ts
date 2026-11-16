/**
 * 文化部藝文活動（server only）：六個類別各抓一次（10 秒逾時），成功的每類快取 6 小時。
 * 抓不到的類別推 warn 警報並當作空的，10 分鐘後再試（避免每個請求都打上游、都推警報），不擋散場之前整頁。
 * 本機 E2E 可用 CULTURE_API_BASE 指到假 server、CULTURE_CACHE_TTL_MS 調快取（正式環境不吃這兩個變數）。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import type { Notify } from "../../../worker/notify";
import { CULTURE_CATEGORIES, parseCultureEvents, selectCultureEvents, type CultureEvent, type CultureKind, type SelectedCultureEvent } from "./culture";
import { externalOverridesAllowed } from "@/lib/e2e-overrides";

export const CULTURE_API = "https://cloud.culture.tw/frontsite/trans/SearchShowAction.do";
export const CULTURE_TIMEOUT_MS = 10_000;
export const CULTURE_TTL_MS = 6 * 60 * 60_000;
/** 抓不到的類別多久後再試（也是同一類別警報的最短間隔） */
export const CULTURE_RETRY_MS = 10 * 60_000;

const ALL_CATEGORIES = [...CULTURE_CATEGORIES.live, ...CULTURE_CATEGORIES.exhibition];

export type CultureEvents = Record<CultureKind, SelectedCultureEvent[]>;

export interface CultureLoaderDeps {
  fetch: typeof fetch;
  base: string;
  ttlMs: number;
  notify: Notify;
  now?: () => number;
}

export function cultureUrl(category: string, base: string): string {
  return `${base}?method=doFindTypeJ&category=${encodeURIComponent(category)}`;
}

export function cultureConfigFromEnv(env: Record<string, string | undefined> = process.env): { base: string; ttlMs: number } {
  if (!externalOverridesAllowed(env)) return { base: CULTURE_API, ttlMs: CULTURE_TTL_MS };
  const base = env.CULTURE_API_BASE?.trim().replace(/\/$/, "") || CULTURE_API;
  const ttl = Number(env.CULTURE_CACHE_TTL_MS);
  return { base, ttlMs: env.CULTURE_CACHE_TTL_MS?.trim() && Number.isFinite(ttl) && ttl >= 0 ? ttl : CULTURE_TTL_MS };
}

async function fetchCategory(category: string, deps: CultureLoaderDeps): Promise<CultureEvent[]> {
  const url = cultureUrl(category, deps.base);
  let response: Response;
  try {
    response = await deps.fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(CULTURE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(`${url}：${error instanceof Error ? error.message : "連線失敗"}`);
  }
  if (!response.ok) throw new Error(`${url} 回應 ${response.status}`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${url} 不是 JSON`);
  }
  if (!Array.isArray(data)) throw new Error(`${url} 格式不對（不是陣列）`);
  return parseCultureEvents(data, category);
}

export function createCultureLoader(deps: CultureLoaderDeps) {
  const now = deps.now ?? Date.now;
  const cache = new Map<string, { events: CultureEvent[]; loadedAt: number; failed: boolean }>();
  const ttlOf = (failed: boolean) => (failed ? Math.min(deps.ttlMs, CULTURE_RETRY_MS) : deps.ttlMs);
  const inflight = new Map<string, Promise<CultureEvent[]>>();

  /** 同一類別同時只打一次上游；失敗記成空的，短時間內不重打（null＝這次才失敗，要推警報） */
  const loadCategory = (category: string): Promise<CultureEvent[]> => {
    const hit = cache.get(category);
    if (hit && now() - hit.loadedAt < ttlOf(hit.failed)) return Promise.resolve(hit.events);
    const pending = inflight.get(category);
    if (pending) return pending;
    const request = fetchCategory(category, deps)
      .then((events) => {
        cache.set(category, { events, loadedAt: now(), failed: false });
        return events;
      })
      .catch((error: unknown) => {
        cache.set(category, { events: [], loadedAt: now(), failed: true });
        throw error;
      })
      .finally(() => inflight.delete(category));
    inflight.set(category, request);
    return request;
  };

  /** 各類別解析過、還沒選場次的活動（失敗的類別推警報、當作空的） */
  const loadAll = async (): Promise<CultureEvent[]> => {
    const results = await Promise.allSettled(ALL_CATEGORIES.map(loadCategory));
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : String(result.reason)] : [],
    );
    if (failures.length > 0) {
      const detail = failures.join("\n");
      console.error("[events] 文化部活動讀不到，該類先留空", { detail });
      void deps.notify("warn", `散場之前：文化部活動 ${failures.length} 類讀不到`, detail).catch(() => undefined);
    }
    return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  };

  return {
    loadAll,
    load: async (today: string): Promise<CultureEvents> => selectCultureEvents(await loadAll(), today),
  };
}

let shared: ReturnType<typeof createCultureLoader> | null = null;

function sharedLoader(): ReturnType<typeof createCultureLoader> {
  shared ??= createCultureLoader({ fetch: (input, init) => fetch(input, init), ...cultureConfigFromEnv(), notify: getServerNotify() });
  return shared;
}

/** 整個 process 共用一份快取：選好場次、各類取上限 */
export function loadCultureEvents(today: string): Promise<CultureEvents> {
  return sharedLoader().load(today);
}

/** 散場之前用：還沒選場次的全部活動（縣市過濾、細類要在取上限之前做，events/pool.ts） */
export function loadCultureCatalog(): Promise<CultureEvent[]> {
  return sharedLoader().loadAll();
}
