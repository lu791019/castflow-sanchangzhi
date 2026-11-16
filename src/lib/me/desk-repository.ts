/**
 * 編輯檯資料存取：一律帶 user_id 過濾，只讀寫自己的集數與貼文。
 * 刪草稿只限未發佈；排程改時間／取消要過鎖定線（schedule.lock）。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { audioPathFromPublicUrl } from "@/lib/audio/upload-path";
import type { DeskEpisodeRow } from "./desk";
import { isScheduleLocked, validateReschedule } from "./schedule";

const DESK_LIMIT = 200;
const DESK_COLUMNS =
  "id, title, source, status, created_at, published_at, share_slug, visibility, " +
  "work:works(kind, title, poster_url, podcast_show, episode_number), " +
  "contents(platform, status, scheduled_at, body, original_body)";

export type DeskMutationResult = { ok: true } | { ok: false; error: string; status: 400 | 404 | 409 };

const NOT_FOUND: DeskMutationResult = { ok: false, error: "找不到這篇", status: 404 };

export async function loadDeskRows(userId: string): Promise<DeskEpisodeRow[]> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select(DESK_COLUMNS)
    .eq("user_id", userId)
    .neq("source", "rss")
    .order("created_at", { ascending: false })
    .limit(DESK_LIMIT);
  if (error) throw new Error(`讀取編輯檯失敗：${error.message}`);
  return (data ?? []) as unknown as DeskEpisodeRow[];
}

/** 連到這篇的視聽日誌（刪集數前先記下：刪後外鍵會把 episode_id 清成 null） */
async function journalIdsOf(userId: string, episodeId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("id")
    .eq("episode_id", episodeId)
    .eq("user_id", userId);
  if (error) throw new Error(`讀取連結日誌失敗：${error.message}`);
  return (data ?? []).map((row) => row.id as string);
}

/** 草稿刪了，日誌回到「還沒說」；remind_at 清掉，避免 worker 立刻再推一次提醒 */
async function reopenJournalEntries(userId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createAdminClient()
    .from("journal_entries")
    .update({ status: "recorded", episode_id: null, remind_at: null })
    .in("id", [...ids])
    .eq("user_id", userId)
    .eq("status", "said");
  // 集數已刪，日誌狀態沒退回只影響顯示；留下完整 log 供修補
  if (error) console.error("[desk] 日誌狀態退回失敗", { ids, message: error.message });
}

/** 刪除草稿：未發佈才可刪；集數（逐字稿、文案隨 cascade）與原錄音檔一起刪 */
export async function deleteDraft(userId: string, episodeId: string): Promise<DeskMutationResult> {
  const supabase = createAdminClient();
  const { data: episode, error } = await supabase
    .from("episodes")
    .select("id, audio_url, published_at")
    .eq("id", episodeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`讀取草稿失敗：${error.message}`);
  if (!episode) return NOT_FOUND;
  if (episode.published_at) return { ok: false, error: "已發佈的文章不能在這裡刪", status: 409 };

  const journalIds = await journalIdsOf(userId, episodeId);
  const { error: deleteError } = await supabase.from("episodes").delete().eq("id", episodeId).eq("user_id", userId);
  if (deleteError) throw new Error(`刪除草稿失敗：${deleteError.message}`);
  await reopenJournalEntries(userId, journalIds);

  const audioPath = audioPathFromPublicUrl(userId, episode.audio_url as string | null);
  if (audioPath) {
    const { error: storageError } = await supabase.storage.from("audio").remove([audioPath]);
    // 集數已刪，錄音檔殘留只佔空間；留下完整 log 供清理
    if (storageError) console.error("[desk] 刪除原錄音失敗", { episodeId, audioPath, message: storageError.message });
  }
  return { ok: true };
}

async function scheduledOf(userId: string, episodeId: string): Promise<Array<{ id: string; scheduled_at: string }>> {
  const { data, error } = await createAdminClient()
    .from("contents")
    .select("id, scheduled_at")
    .eq("episode_id", episodeId)
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null);
  if (error) throw new Error(`讀取排程失敗：${error.message}`);
  return (data ?? []) as Array<{ id: string; scheduled_at: string }>;
}

function lockedResult(rows: Array<{ scheduled_at: string }>, now: Date): DeskMutationResult | null {
  if (rows.length === 0) return NOT_FOUND;
  return rows.some((row) => isScheduleLocked(row.scheduled_at, now))
    ? { ok: false, error: "快要發出去了，不能再改", status: 409 }
    : null;
}

export async function rescheduleEpisode(
  userId: string,
  episodeId: string,
  iso: string,
  now: Date = new Date(),
): Promise<DeskMutationResult> {
  const valid = validateReschedule(iso, now);
  if (!valid.ok) return { ok: false, error: valid.error, status: 400 };
  const rows = await scheduledOf(userId, episodeId);
  const blocked = lockedResult(rows, now);
  if (blocked) return blocked;
  const { error } = await createAdminClient()
    .from("contents")
    .update({ scheduled_at: valid.iso })
    .in(
      "id",
      rows.map((row) => row.id),
    )
    .eq("user_id", userId);
  if (error) throw new Error(`改排程時間失敗：${error.message}`);
  return { ok: true };
}

/** 取消排程：貼文回到草稿，不會發出去 */
export async function cancelEpisodeSchedule(
  userId: string,
  episodeId: string,
  now: Date = new Date(),
): Promise<DeskMutationResult> {
  const rows = await scheduledOf(userId, episodeId);
  const blocked = lockedResult(rows, now);
  if (blocked) return blocked;
  const { error } = await createAdminClient()
    .from("contents")
    .update({ status: "draft", scheduled_at: null })
    .in(
      "id",
      rows.map((row) => row.id),
    )
    .eq("user_id", userId);
  if (error) throw new Error(`取消排程失敗：${error.message}`);
  return { ok: true };
}
