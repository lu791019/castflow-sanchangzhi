/** 作品連結的 DB 接線（server only，service role）：讀公開連結、使用者補連結、場刊手填 */

import { getServerNotify } from "@/lib/alerts/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStoredSnapshot } from "@/lib/watch/providers";
import { loadWatchInfo } from "@/lib/watch/repository";
import { asVenueType } from "@/lib/venue/venue-type";
import type { WorkKind } from "@/lib/works/format";
import { checkLinkForWork, decideUserLinkWrite, planUserLink, type LinkInput } from "./input";
import {
  resolvePrimaryLinks,
  resolveWorkLinks,
  type LinkWork,
  type ListLinkWork,
  type LoadedWorkLinks,
} from "./service";
import { isLinkKind, type StoredLinkOrigin, type WorkLink } from "./types";

const LINK_COLUMNS = "work_id, kind, source, label, url, origin";
const LINK_WORK_COLUMNS = "id, kind, title, tmdb_id, venue_type";

interface LinkRow {
  work_id: string;
  kind: string;
  source: string;
  label: string;
  url: string;
  origin: StoredLinkOrigin;
}

function warn(title: string, detail: string): void {
  console.error(`[links] ${title}`, detail);
  void getServerNotify()("warn", title, detail).catch(() => undefined);
}

function toLink(row: LinkRow): WorkLink[] {
  if (!isLinkKind(row.kind)) return [];
  return [{ kind: row.kind, source: row.source, label: row.label, url: row.url, origin: row.origin, note: null }];
}

/** 公開（status active）的連結，依作品分組 */
export async function listStoredLinks(workIds: readonly string[]): Promise<Map<string, WorkLink[]>> {
  if (workIds.length === 0) return new Map();
  const { data, error } = await createAdminClient()
    .from("work_links")
    .select(LINK_COLUMNS)
    .in("work_id", [...workIds])
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`讀取作品連結失敗：${error.message}`);
  const grouped = new Map<string, WorkLink[]>();
  for (const row of (data ?? []) as LinkRow[]) {
    grouped.set(row.work_id, [...(grouped.get(row.work_id) ?? []), ...toLink(row)]);
  }
  return grouped;
}

function toLinkWork(row: Record<string, unknown>): LinkWork {
  return {
    id: row.id as string,
    kind: row.kind as WorkKind,
    title: row.title as string,
    tmdb_id: (row.tmdb_id as number | null) ?? null,
    venue_type: asVenueType(row.venue_type),
  };
}

export async function findLinkWork(workId: string): Promise<LinkWork | null> {
  const { data, error } = await createAdminClient().from("works").select(LINK_WORK_COLUMNS).eq("id", workId).maybeSingle();
  if (error) throw new Error(`讀取作品失敗：${error.message}`);
  return data ? toLinkWork(data) : null;
}

/** 作品頁／記一筆：合併後的在哪看／買票／官網；作品不存在回 null */
export async function loadWorkLinks(workId: string): Promise<LoadedWorkLinks | null> {
  let work: LinkWork | null;
  try {
    work = await findLinkWork(workId);
  } catch (error) {
    warn("在哪看／買票：讀取作品失敗", `work=${workId} ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  if (!work) return null;
  return resolveWorkLinks(work, {
    listStored: async (id) => (await listStoredLinks([id])).get(id) ?? [],
    loadWatchInfo,
    warn,
  });
}

/** 接下來：每個作品一顆次鈕（批次兩個查詢，不打 TMDB）；失敗推警報並回空 */
export async function loadPrimaryLinks(workIds: readonly string[], now: Date = new Date()): Promise<Map<string, WorkLink | null>> {
  const ids = [...new Set(workIds)];
  if (ids.length === 0) return new Map();
  try {
    const { data, error } = await createAdminClient()
      .from("works")
      .select(`${LINK_WORK_COLUMNS}, watch_providers`)
      .in("id", ids);
    if (error) throw new Error(error.message);
    const works: ListLinkWork[] = (data ?? []).map((row) => ({
      ...toLinkWork(row),
      watch_providers: parseStoredSnapshot((row as { watch_providers: unknown }).watch_providers),
    }));
    return resolvePrimaryLinks(works, await listStoredLinks(ids), now);
  } catch (error) {
    warn("接下來的買票／在哪看連結讀取失敗", `${ids.length} 筆 ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
}

export type UserLinkResult =
  | { ok: true; status: "active" | "pending"; link: WorkLink }
  | { ok: false; reason: "not_found" | "conflict" }
  | { ok: false; reason: "invalid"; error: string };

/** 使用者補一筆（origin user）：同作品同來源只覆蓋自己補的；白名單外待審並推警報 */
export async function saveUserLink(workId: string, userId: string, raw: LinkInput): Promise<UserLinkResult> {
  const work = await findLinkWork(workId);
  if (!work) return { ok: false, reason: "not_found" };
  const checked = checkLinkForWork(work.kind, raw);
  if (!checked.ok) return { ok: false, reason: "invalid", error: checked.error };
  const input = checked.value;
  const plan = planUserLink(input);
  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("work_links")
    .select("id, origin, added_by")
    .eq("work_id", workId)
    .eq("source", plan.source)
    .maybeSingle();
  if (readError) throw new Error(`讀取既有連結失敗：${readError.message}`);
  const decision = decideUserLinkWrite(existing as { origin: StoredLinkOrigin; added_by: string | null } | null, userId);
  if (decision === "conflict") return { ok: false, reason: "conflict" };

  const row = { kind: input.kind, source: plan.source, label: plan.label, url: input.url, origin: "user", status: plan.status, added_by: userId };
  const { error } =
    decision === "insert"
      ? await supabase.from("work_links").insert({ ...row, work_id: workId })
      : await supabase.from("work_links").update({ ...row, updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id);
  if (error) throw new Error(`寫入連結失敗：${error.message}`);
  if (plan.status === "pending") {
    warn("有人補了白名單外的連結，待審", `work=${workId} kind=${input.kind} source=${plan.source}`);
  }
  return {
    ok: true,
    status: plan.status,
    link: { kind: input.kind, source: plan.source, label: plan.label, url: input.url, origin: "user", note: null },
  };
}
