/**
 * 手動作品補資料：kind ∈ (movie, series) 且 tmdb_id 為空、尚未判定過的作品，
 * 用標題（+年份）搜 TMDB。只在「結果唯一」或「第一筆標題完全相同」時回填，其他情況不猜：
 *   - done       回填成功
 *   - ambiguous  多筆且第一筆標題不同
 *   - not_found  查無結果
 *   - duplicate  回填會撞 (kind, tmdb_id) 唯一索引 → 不自動合併，notify
 * TMDB 錯誤走 notify，狀態留空下一輪再試。
 *
 * TMDB 封裝重用 app 的 src/lib/work-picker/tmdb.ts（純函式、fetch 可注入）。
 */

import type { ScreenResult } from "../src/lib/work-picker/types.ts";
import type { TmdbDetail } from "../src/lib/work-picker/tmdb.ts";
import type { Notify } from "./notify.ts";

export const ENRICH_BATCH_LIMIT = 5;

export type EnrichStatus = "done" | "ambiguous" | "not_found" | "duplicate";

export interface PendingWork {
  id: string;
  kind: "movie" | "series";
  title: string;
  year: number | null;
  original_title: string | null;
  poster_url: string | null;
  region: string | null;
  credit: string | null;
}

/** 回填欄位：只補空欄，不覆蓋使用者手填的資料 */
export interface EnrichPatch {
  tmdb_id: number;
  original_title?: string | null;
  year?: number | null;
  poster_url?: string | null;
  region?: string | null;
  credit?: string | null;
}

export type MatchDecision =
  | { type: "match"; result: ScreenResult }
  | { type: "ambiguous"; count: number }
  | { type: "not_found" };

export interface EnrichDeps {
  listPending: (limit: number) => Promise<PendingWork[]>;
  search: (kind: "movie" | "series", title: string, year: number | null) => Promise<ScreenResult[]>;
  detail: (kind: "movie" | "series", tmdbId: number) => Promise<TmdbDetail>;
  /** 同 (kind, tmdb_id) 已存在的其他作品 id；沒有回 null */
  findExisting: (kind: "movie" | "series", tmdbId: number, excludeId: string) => Promise<string | null>;
  /** 回填 + 標 done；撞唯一索引時丟 UniqueViolationError */
  applyPatch: (workId: string, patch: EnrichPatch) => Promise<void>;
  markStatus: (workId: string, status: Exclude<EnrichStatus, "done">) => Promise<void>;
  notify: Notify;
  log: (line: string) => void;
}

export class UniqueViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniqueViolationError";
  }
}

export interface EnrichSummary {
  scanned: number;
  done: number;
  ambiguous: number;
  notFound: number;
  duplicate: number;
  failed: number;
}

/** 比對用：全形轉半形、去空白與常見標點、英文小寫 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s·・:：\-—–,，.。!！?？'"「」『』《》()（）]/g, "");
}

function sameTitle(query: string, result: ScreenResult): boolean {
  const target = normalizeTitle(query);
  if (!target) return false;
  return [result.title, result.originalTitle]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeTitle(value) === target);
}

/** 結果唯一 → match；第一筆標題完全相同 → match；其餘不猜 */
export function decideMatch(title: string, results: ScreenResult[]): MatchDecision {
  if (results.length === 0) return { type: "not_found" };
  if (results.length === 1) return { type: "match", result: results[0] };
  if (sameTitle(title, results[0])) return { type: "match", result: results[0] };
  return { type: "ambiguous", count: results.length };
}

/** 只補空欄 */
export function buildPatch(work: PendingWork, detail: TmdbDetail): EnrichPatch {
  const fill = <K extends keyof PendingWork>(key: K, value: PendingWork[K]) =>
    work[key] === null && value !== null ? { [key]: value } : {};
  return {
    tmdb_id: detail.tmdbId,
    ...fill("original_title", detail.originalTitle),
    ...fill("year", detail.year !== null && detail.year >= 1880 && detail.year <= 2100 ? detail.year : null),
    ...fill("poster_url", detail.posterUrl),
    ...fill("region", detail.region),
    ...fill("credit", detail.credit),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function markDuplicate(work: PendingWork, tmdbId: number, existingId: string | null, deps: EnrichDeps) {
  await deps.markStatus(work.id, "duplicate");
  deps.log(`enrich「${work.title}」(${work.id}) → duplicate：tmdb ${work.kind}/${tmdbId} 已屬於 ${existingId ?? "其他作品"}`);
  await deps.notify(
    "warn",
    "手動作品補資料撞到既有作品（未自動合併）",
    `「${work.title}」(${work.id}) 對到 TMDB ${work.kind}/${tmdbId}，已存在作品 ${existingId ?? "（唯一索引拒絕）"}，請人工決定是否合併`,
  );
}

type Outcome = EnrichStatus | "failed";

async function enrichOne(work: PendingWork, deps: EnrichDeps): Promise<Outcome> {
  let results: ScreenResult[];
  try {
    results = await deps.search(work.kind, work.title, work.year);
  } catch (error) {
    await deps.notify("warn", "補資料：TMDB 搜尋失敗（下一輪重試）", `「${work.title}」(${work.id})：${errorMessage(error)}`);
    return "failed";
  }

  const decision = decideMatch(work.title, results);
  if (decision.type !== "match") {
    const status = decision.type === "ambiguous" ? "ambiguous" : "not_found";
    await deps.markStatus(work.id, status);
    deps.log(
      `enrich「${work.title}」(${work.id}) → ${status}${decision.type === "ambiguous" ? `（${decision.count} 筆，第一筆「${results[0].title}」標題不同）` : ""}`,
    );
    return status;
  }

  const tmdbId = decision.result.tmdbId;
  const existingId = await deps.findExisting(work.kind, tmdbId, work.id);
  if (existingId) {
    await markDuplicate(work, tmdbId, existingId, deps);
    return "duplicate";
  }

  let detail: TmdbDetail;
  try {
    detail = await deps.detail(work.kind, tmdbId);
  } catch (error) {
    await deps.notify("warn", "補資料：TMDB 詳情失敗（下一輪重試）", `「${work.title}」(${work.id}) tmdb ${tmdbId}：${errorMessage(error)}`);
    return "failed";
  }

  try {
    await deps.applyPatch(work.id, buildPatch(work, detail));
  } catch (error) {
    if (error instanceof UniqueViolationError) {
      await markDuplicate(work, tmdbId, null, deps);
      return "duplicate";
    }
    throw error;
  }
  deps.log(`enrich「${work.title}」(${work.id}) → done：tmdb ${work.kind}/${tmdbId}「${detail.title}」${detail.year ?? ""}`);
  return "done";
}

const EMPTY_SUMMARY: EnrichSummary = { scanned: 0, done: 0, ambiguous: 0, notFound: 0, duplicate: 0, failed: 0 };

const SUMMARY_KEY: Record<Outcome, keyof EnrichSummary> = {
  done: "done",
  ambiguous: "ambiguous",
  not_found: "notFound",
  duplicate: "duplicate",
  failed: "failed",
};

/** 一輪：最多處理 limit 筆；單筆 DB 錯誤 notify error 後繼續下一筆 */
export async function runEnrichBatch(deps: EnrichDeps, limit = ENRICH_BATCH_LIMIT): Promise<EnrichSummary> {
  let pending: PendingWork[];
  try {
    pending = await deps.listPending(limit);
  } catch (error) {
    await deps.notify("error", "補資料：讀取待補作品失敗（Supabase 無法連線？）", errorMessage(error));
    return EMPTY_SUMMARY;
  }

  let summary: EnrichSummary = { ...EMPTY_SUMMARY, scanned: pending.length };
  for (const work of pending) {
    let outcome: Outcome;
    try {
      outcome = await enrichOne(work, deps);
    } catch (error) {
      await deps.notify("error", "補資料：寫回作品失敗", `「${work.title}」(${work.id})：${errorMessage(error)}`);
      outcome = "failed";
    }
    const key = SUMMARY_KEY[outcome];
    summary = { ...summary, [key]: summary[key] + 1 };
  }
  return summary;
}
