/** 「看完了」資料存取（server only，service role＋userId 過濾） */

import { createAdminClient } from "@/lib/supabase/admin";
import { createJournalEntry } from "@/lib/journal/repository";
import { UUID_PATTERN, type Venue } from "@/lib/journal/types";
import { parseCreateJournalInput } from "@/lib/journal/validate";
import { loadProofData, type ProofData } from "@/lib/proof/load";
import { WATCHED_LONGFORM_PLATFORM, WATCHED_POST_PLATFORM } from "./post";

export interface StartWatchedInput {
  /** 從「還沒說的日誌」帶入時沿用那一筆；否則新建 */
  journalId: string | null;
  workId: string | null;
  workTitle: string | null;
  rating: number | null;
  venue: Venue;
  companions: string | null;
}

export class WatchedInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WatchedInputError";
  }
}

/** 回傳日誌 id；沿用時只更新星等／場域／同行，且必須是本人、已看過、還沒說 */
export async function startWatchedEntry(userId: string, input: StartWatchedInput, now: Date = new Date()): Promise<string> {
  if (input.journalId) {
    if (!UUID_PATTERN.test(input.journalId)) throw new WatchedInputError("journalId 格式錯誤");
    const { data, error } = await createAdminClient()
      .from("journal_entries")
      .update({ rating: input.rating, venue: input.venue, companions: input.companions })
      .eq("id", input.journalId)
      .eq("user_id", userId)
      .eq("status", "recorded")
      .is("episode_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`更新日誌失敗：${error.message}`);
    if (!data) throw new WatchedInputError("找不到這筆紀錄，或已經說過了");
    return data.id as string;
  }
  const parsed = parseCreateJournalInput(
    {
      workId: input.workId,
      workTitle: input.workTitle,
      experiencedAt: now.toISOString(),
      venue: input.venue,
      companions: input.companions,
      rating: input.rating,
    },
    now,
  );
  if (!parsed.ok) throw new WatchedInputError(parsed.error);
  const entry = await createJournalEntry(userId, parsed.value);
  return entry.id;
}

export interface WatchedData {
  proof: ProofData;
  rating: number | null;
  post: string | null;
  longform: string | null;
}

export async function loadWatchedData(episodeId: string, userId: string): Promise<WatchedData | null> {
  const proof = await loadProofData(episodeId, userId);
  if (!proof) return null;
  const supabase = createAdminClient();
  const [contents, journal] = await Promise.all([
    supabase
      .from("contents")
      .select("platform, body")
      .eq("episode_id", episodeId)
      .eq("user_id", userId)
      .in("platform", [WATCHED_POST_PLATFORM, WATCHED_LONGFORM_PLATFORM]),
    supabase
      .from("journal_entries")
      .select("rating")
      .eq("episode_id", episodeId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);
  const error = contents.error ?? journal.error;
  if (error) throw new Error(`讀取看完了失敗：${error.message}`);
  const rows = (contents.data ?? []) as Array<{ platform: string; body: string }>;
  const bodyOf = (platform: string) => rows.find((row) => row.platform === platform)?.body ?? null;
  const rating = (journal.data as { rating: number | string | null } | null)?.rating;
  return {
    proof,
    rating: rating === null || rating === undefined ? null : Number(rating),
    post: bodyOf(WATCHED_POST_PLATFORM),
    longform: bodyOf(WATCHED_LONGFORM_PLATFORM),
  };
}

/** 存一份產出（覆蓋同 platform 舊的）；original 只在 AI 產出時寫，之後編輯只動 body */
export async function saveWatchedContent(
  userId: string,
  episodeId: string,
  platform: typeof WATCHED_POST_PLATFORM | typeof WATCHED_LONGFORM_PLATFORM,
  body: string,
  fromAi: boolean,
): Promise<void> {
  const supabase = createAdminClient();
  const { data: existing, error: findError } = await supabase
    .from("contents")
    .select("id")
    .eq("episode_id", episodeId)
    .eq("user_id", userId)
    .eq("platform", platform)
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(`讀取產出失敗：${findError.message}`);
  const patch = fromAi ? { body, original_body: body } : { body };
  const { error } = existing
    ? await supabase.from("contents").update(patch).eq("id", (existing as { id: string }).id)
    : await supabase
        .from("contents")
        .insert({ user_id: userId, episode_id: episodeId, platform, status: "draft", ...patch, original_body: body });
  if (error) throw new Error(`儲存產出失敗：${error.message}`);
}
