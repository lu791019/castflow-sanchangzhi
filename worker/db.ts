import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  EpisodeStatus,
  QueuedEpisode,
  TranscriptionResult,
} from "./types.ts";
import type { DueReminder, StoredPushSubscription } from "./reminders.ts";
import type { ReadyEpisode } from "./ready.ts";

export type WorkerDb = SupabaseClient;

export function createDb(url: string, serviceKey: string): WorkerDb {
  return createClient(url, serviceKey);
}

/** 撈待轉錄佇列：status=uploaded 且有 audio_url，舊的先處理 */
export async function fetchQueuedEpisodes(
  db: WorkerDb,
  limit: number,
): Promise<QueuedEpisode[]> {
  const { data, error } = await db
    .from("episodes")
    .select("id, title, audio_url")
    .eq("status", "uploaded")
    .not("audio_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`讀取待轉錄佇列失敗：${error.message}`);
  }
  return (data ?? []) as QueuedEpisode[];
}

/**
 * 原子認領：僅在仍是 uploaded 時改 transcribing。
 * 回傳 false 代表被別人（如 /say 行內轉錄）搶先，跳過即可。
 */
export async function claimEpisode(db: WorkerDb, episodeId: string): Promise<boolean> {
  const { data, error } = await db
    .from("episodes")
    .update({ status: "transcribing" })
    .eq("id", episodeId)
    .eq("status", "uploaded")
    .select("id");

  if (error) {
    throw new Error(`認領 episode 失敗：${error.message}`);
  }
  return (data ?? []).length > 0;
}

export async function saveTranscript(
  db: WorkerDb,
  episodeId: string,
  result: TranscriptionResult,
): Promise<void> {
  const { error } = await db.from("transcripts").insert({
    episode_id: episodeId,
    full_text: result.fullText,
    segments: result.segments,
    language: result.language,
  });
  if (error) {
    throw new Error(`寫入 transcript 失敗：${error.message}`);
  }
}

export async function setEpisodeStatus(
  db: WorkerDb,
  episodeId: string,
  status: EpisodeStatus,
): Promise<void> {
  const { error } = await db
    .from("episodes")
    .update({ status })
    .eq("id", episodeId);
  if (error) {
    throw new Error(`更新 episode 狀態失敗：${error.message}`);
  }
}

// ── 視聽日誌提醒 ────────────────────────────────────────────

/** 建 App 內提醒通知；unique(journal_entry_id, kind) 衝突時不重建，回傳是否為新建 */
export async function insertReminderNotification(
  db: WorkerDb,
  reminder: DueReminder,
): Promise<boolean> {
  const { data, error } = await db
    .from("notifications")
    .upsert(
      {
        kind: reminder.kind ?? "say_reminder",
        journal_entry_id: reminder.journalEntryId,
        title: reminder.title,
        body: reminder.body,
      },
      { onConflict: "journal_entry_id,kind", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    throw new Error(`寫入通知失敗：${error.message}`);
  }
  return (data ?? []).length > 0;
}

export async function listPushSubscriptions(db: WorkerDb): Promise<StoredPushSubscription[]> {
  const { data, error } = await db.from("push_subscriptions").select("endpoint, keys, user_id");
  if (error) {
    throw new Error(`讀取推播訂閱失敗：${error.message}`);
  }
  const rows = (data ?? []) as Array<Omit<StoredPushSubscription, "userId"> & { user_id: string }>;
  return rows.map(({ user_id, ...rest }) => ({ ...rest, userId: user_id }));
}

export async function deletePushSubscription(db: WorkerDb, endpoint: string): Promise<void> {
  const { error } = await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    throw new Error(`刪除推播訂閱失敗：${error.message}`);
  }
}

/** 只在尚未提醒時寫入，避免覆蓋既有時間 */
export async function markJournalReminded(db: WorkerDb, journalEntryId: string): Promise<void> {
  const { error } = await db
    .from("journal_entries")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", journalEntryId)
    .is("reminded_at", null);
  if (error) {
    throw new Error(`寫入 reminded_at 失敗：${error.message}`);
  }
}

const READY_BATCH_LIMIT = 20;
/** 太久以前轉好的不補推（worker 停機很久後重啟，不把舊錄音全推一遍） */
const READY_MAX_AGE_MS = 48 * 60 * 60 * 1000;

interface ReadyRow {
  id: string;
  user_id: string;
  works: { title: string; kind: string; podcast_show: string | null } | null;
}

/** 說一段錄音已轉成文字、還沒推「整理好了」的集數 */
export async function fetchReadyEpisodes(db: WorkerDb, now: Date = new Date()): Promise<ReadyEpisode[]> {
  const { data, error } = await db
    .from("episodes")
    .select("id, user_id, works(title, kind, podcast_show)")
    .eq("source", "audio")
    .eq("status", "transcribed")
    .is("ready_notified_at", null)
    .gte("created_at", new Date(now.getTime() - READY_MAX_AGE_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(READY_BATCH_LIMIT);
  if (error) {
    throw new Error(`讀取待推「整理好了」失敗：${error.message}`);
  }
  return ((data ?? []) as unknown as ReadyRow[]).map((row) => ({
    episodeId: row.id,
    userId: row.user_id,
    workTitle:
      row.works?.kind === "podcast_episode" && row.works.podcast_show
        ? row.works.podcast_show
        : (row.works?.title ?? null),
  }));
}

/** 搶寫 ready_notified_at：只有這次寫到（原本是 null）才回 true */
export async function claimReadyNotified(db: WorkerDb, episodeId: string): Promise<boolean> {
  const { data, error } = await db
    .from("episodes")
    .update({ ready_notified_at: new Date().toISOString() })
    .eq("id", episodeId)
    .is("ready_notified_at", null)
    .select("id");
  if (error) {
    throw new Error(`寫入 ready_notified_at 失敗：${error.message}`);
  }
  return (data ?? []).length > 0;
}
