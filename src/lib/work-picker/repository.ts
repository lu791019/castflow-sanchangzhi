/** 作品選擇器的資料存取（server only，service role）：去重查詢、建立、最近綁定、感受數批次 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PICKER_WORK_COLUMNS, type PickerWork } from "./types";
import { countByWorkId, uniqueInOrder, type WorkInsert } from "./work-rows";

const PG_UNIQUE_VIOLATION = "23505";
export const RECENT_PICKS_MAX = 6;
/** 回推多少集來找最近綁定過的作品（去重後取前 6） */
const RECENT_EPISODE_SCAN = 40;

type Client = ReturnType<typeof createAdminClient>;

function logError(scope: string, context: Record<string, unknown>, message: string): void {
  console.error(`[work-picker] ${scope} failed`, { ...context, message });
}

export async function findWorkByTmdb(
  kind: "movie" | "series",
  tmdbId: number,
  client: Client = createAdminClient(),
): Promise<PickerWork | null> {
  const { data, error } = await client
    .from("works")
    .select(PICKER_WORK_COLUMNS)
    .eq("kind", kind)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (error) {
    logError("findWorkByTmdb", { kind, tmdbId }, error.message);
    throw new Error("查作品失敗");
  }
  return (data as PickerWork | null) ?? null;
}

export async function findWorkByPodcastKey(
  feedUrl: string,
  guid: string,
  client: Client = createAdminClient(),
): Promise<PickerWork | null> {
  const { data, error } = await client
    .from("works")
    .select(PICKER_WORK_COLUMNS)
    .eq("feed_url", feedUrl)
    .eq("episode_guid", guid)
    .maybeSingle();
  if (error) {
    logError("findWorkByPodcastKey", { feedUrl, guid }, error.message);
    throw new Error("查作品失敗");
  }
  return (data as PickerWork | null) ?? null;
}

/** 音樂專輯：以 itunes_id 判同一張（migration 037 唯一索引） */
export async function findWorkByMusicId(
  itunesId: number,
  client: Client = createAdminClient(),
): Promise<PickerWork | null> {
  const { data, error } = await client
    .from("works")
    .select(PICKER_WORK_COLUMNS)
    .eq("kind", "music")
    .eq("itunes_id", itunesId)
    .maybeSingle();
  if (error) {
    logError("findWorkByMusicId", { itunesId }, error.message);
    throw new Error("查作品失敗");
  }
  return (data as PickerWork | null) ?? null;
}

/**
 * 既有手動建的作品（沒 tmdb_id）若與 TMDB 結果同 kind 同名，視為同一部：補上 tmdb_id 與缺的欄位，不另建一列。
 * 只補 null 欄位，不覆蓋使用者已填的資料。
 */
export async function claimLegacyWork(
  row: WorkInsert,
  client: Client = createAdminClient(),
): Promise<PickerWork | null> {
  if (row.tmdb_id === null) return null;
  const { data: legacy, error } = await client
    .from("works")
    .select(PICKER_WORK_COLUMNS)
    .eq("kind", row.kind)
    .eq("title", row.title)
    .is("tmdb_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    logError("claimLegacyWork.find", { kind: row.kind, title: row.title }, error.message);
    throw new Error("查作品失敗");
  }
  if (!legacy) return null;
  const work = legacy as PickerWork;
  const patch = {
    tmdb_id: row.tmdb_id,
    original_title: work.original_title ?? row.original_title,
    year: work.year ?? row.year,
    region: work.region ?? row.region,
    credit: work.credit ?? row.credit,
    poster_url: work.poster_url ?? row.poster_url,
  };
  const { data, error: updateError } = await client
    .from("works")
    .update(patch)
    .eq("id", work.id)
    .select(PICKER_WORK_COLUMNS)
    .single();
  if (updateError) {
    logError("claimLegacyWork.update", { id: work.id }, updateError.message);
    throw new Error("更新作品失敗");
  }
  return data as PickerWork;
}

/** 建立作品；撞到唯一鍵（並發重複選）就回既有列 */
export async function insertWork(
  row: WorkInsert,
  client: Client = createAdminClient(),
): Promise<PickerWork> {
  const { data, error } = await client.from("works").insert(row).select(PICKER_WORK_COLUMNS).single();
  if (!error) return data as PickerWork;
  if (error.code === PG_UNIQUE_VIOLATION) {
    const existing = await findBySlug(row.slug, client);
    if (existing) return existing;
  }
  logError("insertWork", { slug: row.slug, kind: row.kind }, error.message);
  throw new Error("建立作品失敗");
}

export async function findBySlug(slug: string, client: Client = createAdminClient()): Promise<PickerWork | null> {
  const { data } = await client.from("works").select(PICKER_WORK_COLUMNS).eq("slug", slug).maybeSingle();
  return (data as PickerWork | null) ?? null;
}

interface WorkKeyRow {
  id: string;
  tmdb_id: number | null;
  episode_guid: string | null;
}

/** 已發佈公開的感受數（與 works/repository.listWorkFeelings 同一組條件），逐 work_id 計 */
async function countFeelings(workIds: string[], client: Client): Promise<Record<string, number>> {
  if (workIds.length === 0) return {};
  const { data, error } = await client
    .from("episodes")
    .select("work_id")
    .in("work_id", workIds)
    .eq("visibility", "public")
    .not("share_slug", "is", null)
    .not("published_at", "is", null)
    .neq("source", "rss");
  if (error) {
    logError("countFeelings", { count: workIds.length }, error.message);
    return {};
  }
  return countByWorkId((data ?? []) as Array<{ work_id: string }>);
}

/** 電影／影集：{ tmdb_id: 感受數 }（一次查，避免 N+1） */
export async function feelingCountsByTmdb(
  kind: "movie" | "series",
  tmdbIds: number[],
  client: Client = createAdminClient(),
): Promise<Record<number, number>> {
  if (tmdbIds.length === 0) return {};
  const { data, error } = await client
    .from("works")
    .select("id, tmdb_id, episode_guid")
    .eq("kind", kind)
    .in("tmdb_id", tmdbIds);
  if (error) {
    logError("feelingCountsByTmdb", { kind, count: tmdbIds.length }, error.message);
    return {};
  }
  const rows = (data ?? []) as WorkKeyRow[];
  const counts = await countFeelings(rows.map((row) => row.id), client);
  return Object.fromEntries(
    rows.filter((row) => row.tmdb_id !== null).map((row) => [row.tmdb_id as number, counts[row.id] ?? 0]),
  );
}

/** 音樂專輯：{ itunes_id: 感受數 }（一次查） */
export async function feelingCountsByMusic(
  itunesIds: number[],
  client: Client = createAdminClient(),
): Promise<Record<number, number>> {
  if (itunesIds.length === 0) return {};
  const { data, error } = await client.from("works").select("id, itunes_id").eq("kind", "music").in("itunes_id", itunesIds);
  if (error) {
    logError("feelingCountsByMusic", { count: itunesIds.length }, error.message);
    return {};
  }
  const rows = (data ?? []) as Array<{ id: string; itunes_id: number | null }>;
  const counts = await countFeelings(rows.map((row) => row.id), client);
  return Object.fromEntries(
    rows.filter((row) => row.itunes_id !== null).map((row) => [row.itunes_id as number, counts[row.id] ?? 0]),
  );
}

/** Podcast 單集：{ guid: 感受數 }，以 feed_url 一次撈 */
export async function feelingCountsByFeed(
  feedUrl: string,
  client: Client = createAdminClient(),
): Promise<Record<string, number>> {
  const { data, error } = await client
    .from("works")
    .select("id, tmdb_id, episode_guid")
    .eq("feed_url", feedUrl);
  if (error) {
    logError("feelingCountsByFeed", { feedUrl }, error.message);
    return {};
  }
  const rows = (data ?? []) as WorkKeyRow[];
  const counts = await countFeelings(rows.map((row) => row.id), client);
  return Object.fromEntries(
    rows.filter((row) => row.episode_guid !== null).map((row) => [row.episode_guid as string, counts[row.id] ?? 0]),
  );
}

/** 「最近看過／聽過」：最近綁定過作品的集數 → 作品（去重保序，≤ 6），回完整列供直接選定 */
/** 只看這位使用者自己綁過的作品（其他人的「最近」不外流） */
export async function listRecentPicks(
  userId: string,
  limit = RECENT_PICKS_MAX,
  client: Client = createAdminClient(),
): Promise<PickerWork[]> {
  const { data: episodes, error } = await client
    .from("episodes")
    .select("work_id")
    .eq("user_id", userId)
    .not("work_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_EPISODE_SCAN);
  if (error) {
    logError("listRecentPicks.episodes", { userId }, error.message);
    return [];
  }
  const ids = uniqueInOrder((episodes ?? []).map((row) => row.work_id as string | null), limit);
  if (ids.length === 0) return [];

  const { data: works, error: worksError } = await client
    .from("works")
    .select(PICKER_WORK_COLUMNS)
    .in("id", ids);
  if (worksError) {
    logError("listRecentPicks.works", { count: ids.length }, worksError.message);
    return [];
  }
  const byId = new Map(((works ?? []) as PickerWork[]).map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
