/** 補資料 job 的接線：Supabase（service key）讀寫 works + TMDB 封裝 */

import { fetchTmdbDetail, searchTmdb, type TmdbDeps } from "../src/lib/work-picker/tmdb.ts";
import type { WorkerDb } from "./db.ts";
import {
  UniqueViolationError,
  type EnrichDeps,
  type EnrichPatch,
  type EnrichStatus,
  type PendingWork,
} from "./enrich-works.ts";
import type { Notify } from "./notify.ts";

const PG_UNIQUE_VIOLATION = "23505";

export async function listPendingWorks(db: WorkerDb, limit: number): Promise<PendingWork[]> {
  const { data, error } = await db
    .from("works")
    .select("id, kind, title, year, original_title, poster_url, region, credit")
    .in("kind", ["movie", "series"])
    .is("tmdb_id", null)
    .is("enrich_status", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`讀取待補作品失敗：${error.message}`);
  return (data ?? []) as PendingWork[];
}

export async function findExistingWork(
  db: WorkerDb,
  kind: "movie" | "series",
  tmdbId: number,
  excludeId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("works")
    .select("id")
    .eq("kind", kind)
    .eq("tmdb_id", tmdbId)
    .neq("id", excludeId)
    .limit(1);
  if (error) throw new Error(`查詢既有作品失敗：${error.message}`);
  return data && data.length > 0 ? (data[0] as { id: string }).id : null;
}

export async function applyEnrichPatch(db: WorkerDb, workId: string, patch: EnrichPatch): Promise<void> {
  const { error } = await db
    .from("works")
    .update({ ...patch, enrich_status: "done" })
    .eq("id", workId)
    .is("tmdb_id", null);
  if (error?.code === PG_UNIQUE_VIOLATION) throw new UniqueViolationError(error.message);
  if (error) throw new Error(`回填作品失敗：${error.message}`);
}

export async function markEnrichStatus(
  db: WorkerDb,
  workId: string,
  status: Exclude<EnrichStatus, "done">,
): Promise<void> {
  const { error } = await db.from("works").update({ enrich_status: status }).eq("id", workId);
  if (error) throw new Error(`標記 enrich_status 失敗：${error.message}`);
}

export function createEnrichDeps(
  db: WorkerDb,
  tmdb: TmdbDeps,
  notify: Notify,
  log: (line: string) => void,
): EnrichDeps {
  return {
    listPending: (limit) => listPendingWorks(db, limit),
    search: (kind, title, year) => searchTmdb(kind, title, tmdb, { year }),
    detail: (kind, tmdbId) => fetchTmdbDetail(kind, tmdbId, tmdb),
    findExisting: (kind, tmdbId, excludeId) => findExistingWork(db, kind, tmdbId, excludeId),
    applyPatch: (workId, patch) => applyEnrichPatch(db, workId, patch),
    markStatus: (workId, status) => markEnrichStatus(db, workId, status),
    notify,
    log,
  };
}
