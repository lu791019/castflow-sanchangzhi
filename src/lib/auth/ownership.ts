/**
 * 擁有權檢查（server only，service role）。
 * RLS 尚未開啟，所有以 id 操作的寫入都必須先過這裡；不屬於自己的一律當成「找不到」，不透露存在與否。
 */

import { createAdminClient } from "@/lib/supabase/admin";

type OwnedTable = "episodes" | "contents" | "style_dnas" | "journal_entries";

async function ownsRow(table: OwnedTable, userId: string, id: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // 非法 uuid 等查詢錯誤視為不屬於自己；記 log 方便追查
    console.error(`[auth] ownership check failed`, { table, id, message: error.message });
    return false;
  }
  return Boolean(data);
}

export function ownsEpisode(userId: string, episodeId: string): Promise<boolean> {
  return ownsRow("episodes", userId, episodeId);
}

export function ownsContent(userId: string, contentId: string): Promise<boolean> {
  return ownsRow("contents", userId, contentId);
}

export function ownsStyle(userId: string, styleId: string): Promise<boolean> {
  return ownsRow("style_dnas", userId, styleId);
}

export function ownsJournalEntry(userId: string, journalId: string): Promise<boolean> {
  return ownsRow("journal_entries", userId, journalId);
}
