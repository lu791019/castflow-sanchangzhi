/**
 * 視聽日誌 ↔ 說一段的接線（server only，走 service role）：
 * - 送出說一段：把 episode 連到該筆紀錄（status 仍是 recorded，尚未說完）
 * - 校樣存草稿／發佈：該 episode 連到的紀錄標 said
 * - 署名：依 episode 讀回連結的紀錄（公開分享頁也用，不過濾使用者）
 * 寫入都限定 userId（只能動自己的紀錄）。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { toEpisodeJournal, type EpisodeJournal, type EpisodeJournalRow } from "./episode-byline";
import { UUID_PATTERN } from "./types";

export class JournalLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalLinkError";
  }
}

/** 送出說一段：寫入 episode_id（找不到紀錄或寫入失敗會拋出） */
export async function linkJournalToEpisode(
  userId: string,
  journalId: string,
  episodeId: string,
): Promise<void> {
  if (!UUID_PATTERN.test(journalId) || !UUID_PATTERN.test(episodeId)) {
    throw new JournalLinkError("journalId 或 episodeId 格式不正確");
  }
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .update({ episode_id: episodeId })
    .eq("id", journalId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new JournalLinkError(`連結日誌失敗：${error.message}`);
  if (!data) throw new JournalLinkError(`找不到日誌紀錄：${journalId}`);
}

/** 存草稿／發佈後：把連到這篇的紀錄標 said（並確保 episode_id 寫入）。回傳更新筆數 */
export async function markJournalSaidForEpisode(userId: string, episodeId: string): Promise<number> {
  if (!UUID_PATTERN.test(episodeId)) return 0;
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .update({ status: "said", episode_id: episodeId })
    .eq("episode_id", episodeId)
    .eq("user_id", userId)
    .neq("status", "said")
    .select("id");
  if (error) throw new JournalLinkError(`標記已說失敗：${error.message}`);
  return data?.length ?? 0;
}

/** 依 episode 讀回連結的紀錄（多筆取最新）；讀取失敗記 log 並退回 null（署名改用錄下時刻） */
export async function loadEpisodeJournal(episodeId: string): Promise<EpisodeJournal | null> {
  if (!UUID_PATTERN.test(episodeId)) return null;
  const { data, error } = await createAdminClient()
    .from("journal_entries")
    .select("id, experienced_at, venue, works(kind)")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[journal] loadEpisodeJournal failed", { episodeId, message: error.message });
    return null;
  }
  return toEpisodeJournal(data as EpisodeJournalRow | null);
}
