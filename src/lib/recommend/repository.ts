/**
 * 推薦訊號存取（server only，service role；一律帶 userId 過濾）：
 * 自己寫過的文章（任何公開範圍、含草稿）與自己的日誌所綁的作品。只回給本人的推薦用。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkKind } from "@/lib/works/format";
import type { JournalSeedRow, SeedRow } from "./signals";

/** 只看最近這麼多筆，夠當種子也夠排除 */
const WRITTEN_LIMIT = 50;
const JOURNAL_LIMIT = 300;

type WorkJoin = { kind: WorkKind; tmdb_id: number | null; title: string };
type Join = WorkJoin | WorkJoin[] | null;

function workOf(join: Join): WorkJoin | null {
  if (!join) return null;
  return Array.isArray(join) ? (join[0] ?? null) : join;
}

function toRow(workId: string, join: Join): SeedRow | null {
  const work = workOf(join);
  return work ? { workId, title: work.title, kind: work.kind, tmdbId: work.tmdb_id } : null;
}

export async function loadWrittenWorks(userId: string): Promise<SeedRow[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("work_id, works(kind, tmdb_id, title)")
    .eq("user_id", userId)
    .not("work_id", "is", null)
    .neq("source", "rss")
    .order("created_at", { ascending: false })
    .limit(WRITTEN_LIMIT);
  if (error) throw new Error(`讀取寫過的作品失敗：${error.message}`);
  return ((data ?? []) as unknown as Array<{ work_id: string; works: Join }>).flatMap((row) => {
    const seed = toRow(row.work_id, row.works);
    return seed ? [seed] : [];
  });
}

export async function loadJournalWorks(userId: string): Promise<JournalSeedRow[]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("work_id, status, works(kind, tmdb_id, title)")
    .eq("user_id", userId)
    .not("work_id", "is", null)
    .order("experienced_at", { ascending: false })
    .limit(JOURNAL_LIMIT);
  if (error) throw new Error(`讀取日誌作品失敗：${error.message}`);
  return ((data ?? []) as unknown as Array<{ work_id: string; status: JournalSeedRow["status"]; works: Join }>).flatMap((row) => {
    const seed = toRow(row.work_id, row.works);
    return seed ? [{ ...seed, status: row.status }] : [];
  });
}
