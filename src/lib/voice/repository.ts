/** 語氣樣本存取（server only，走 service role；一律帶 userId 過濾——表對 anon／authenticated 全撤權限） */

import { createAdminClient } from "@/lib/supabase/admin";
import { isUsableSpokenSample, MAX_PASTED_SAMPLES, type VoiceSample } from "./samples";

const COLUMNS = "id, body, source, created_at";
/** 說過的原話只留最近這麼多段當樣本來源（挑選時自己貼的優先） */
const SPOKEN_LIST_LIMIT = 20;

export class TooManySamplesError extends Error {
  constructor() {
    super(`自己貼的樣本最多 ${MAX_PASTED_SAMPLES} 篇，先刪掉一篇再貼`);
    this.name = "TooManySamplesError";
  }
}

export async function listVoiceSamples(userId: string): Promise<VoiceSample[]> {
  const supabase = createAdminClient();
  const [pasted, spoken] = await Promise.all([
    supabase
      .from("voice_samples")
      .select(COLUMNS)
      .eq("user_id", userId)
      .neq("source", "spoken")
      .order("created_at", { ascending: false }),
    supabase
      .from("voice_samples")
      .select(COLUMNS)
      .eq("user_id", userId)
      .eq("source", "spoken")
      .order("created_at", { ascending: false })
      .limit(SPOKEN_LIST_LIMIT),
  ]);
  const error = pasted.error ?? spoken.error;
  if (error) throw new Error(`讀取語氣樣本失敗：${error.message}`);
  return [...(pasted.data ?? []), ...(spoken.data ?? [])] as VoiceSample[];
}

/** 自己貼的篇數（設定頁顯示） */
export async function countPastedSamples(userId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("voice_samples")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "paste");
  if (error) throw new Error(`讀取語氣樣本失敗：${error.message}`);
  return count ?? 0;
}

export async function addPastedSample(userId: string, body: string): Promise<VoiceSample> {
  if ((await countPastedSamples(userId)) >= MAX_PASTED_SAMPLES) throw new TooManySamplesError();

  const { data, error } = await createAdminClient()
    .from("voice_samples")
    .insert({ user_id: userId, body, source: "paste" })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(`儲存語氣樣本失敗：${error?.message ?? "unknown"}`);
  return data as VoiceSample;
}

/** 只刪自己的；回傳是否真的刪到 */
export async function deleteVoiceSample(userId: string, id: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("voice_samples")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(`刪除語氣樣本失敗：${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * 說一段轉錄完，把本人的原話收成樣本（同一段只收一次）。
 * 只收逐字稿，不收 AI 整理後的任何版本。太短不收。
 */
export async function recordSpokenSample(userId: string, episodeId: string, transcript: string): Promise<void> {
  if (!isUsableSpokenSample(transcript)) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("voice_samples")
    .upsert(
      { user_id: userId, episode_id: episodeId, body: transcript.trim().slice(0, 5000), source: "spoken" },
      { onConflict: "episode_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(`收錄說過的原話失敗：${error.message}`);
}
