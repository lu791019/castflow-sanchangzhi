"use server";

import { linkJournalToEpisode } from "@/lib/journal/episode-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { getServerNotify } from "@/lib/alerts/notify";
import { deleteDraft } from "@/lib/me/desk-repository";
import { isTooShortToGenerate } from "@/lib/say/meaningful";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VOICE_BYTES = 25 * 1024 * 1024;
const MAX_TITLE_LENGTH = 200;

export interface EpisodeProgress {
  status: string;
  hasBlog: boolean;
  shareSlug: string | null;
}

/** 整理中輪詢：回報集數狀態與是否已有 blog 文案 */
export async function getEpisodeProgressAction(
  episodeId: string,
): Promise<{ progress?: EpisodeProgress; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };
  if (!UUID_PATTERN.test(episodeId)) {
    return { error: "episodeId 格式不正確" };
  }

  const supabase = createAdminClient();
  const [episodeRes, contentRes] = await Promise.all([
    supabase
      .from("episodes")
      .select("status, share_slug")
      .eq("id", episodeId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .eq("episode_id", episodeId)
      .eq("user_id", userId)
      .eq("platform", "blog"),
  ]);

  if (episodeRes.error || !episodeRes.data) {
    return { error: "找不到集數" };
  }

  return {
    progress: {
      status: episodeRes.data.status,
      hasBlog: (contentRes.count ?? 0) > 0,
      shareSlug: episodeRes.data.share_slug ?? null,
    },
  };
}

/**
 * 用說的：收錄音檔 → 存 Storage audio bucket → 建 episode（uploaded）。
 * 走 server action（service role）而非 client 直傳，避免匿名 Storage RLS 限制；
 * 之後沿用既有 startTranscriptionAction 轉錄管線。
 */
export async function createSpokenEpisodeAction(formData: FormData): Promise<{
  episodeId?: string;
  error?: string;
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };
  const file = formData.get("audio");
  const rawTitle = formData.get("title");
  const rawWorkId = formData.get("workId");
  const rawJournalId = formData.get("journalId");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "沒有收到錄音內容" };
  }
  // 從作品特輯進來（/say?work=<slug>）時綁定作品；選填，有給必須是 UUID
  const workId =
    typeof rawWorkId === "string" && rawWorkId ? rawWorkId : null;
  if (workId && !UUID_PATTERN.test(workId)) {
    return { error: "workId 格式不正確" };
  }
  // 從視聽日誌進來（/say?journal=<id>）時連結該筆紀錄；選填，有給必須是 UUID
  const journalId =
    typeof rawJournalId === "string" && rawJournalId ? rawJournalId : null;
  if (journalId && !UUID_PATTERN.test(journalId)) {
    return { error: "journalId 格式不正確" };
  }
  if (file.size > MAX_VOICE_BYTES) {
    return { error: "錄音檔超過 25MB，請縮短後再試" };
  }
  const title =
    typeof rawTitle === "string" && rawTitle.trim()
      ? rawTitle.trim().slice(0, MAX_TITLE_LENGTH)
      : "散場隨筆";

  const supabase = createAdminClient();
  const extension = file.type.includes("mp4") ? "m4a" : "webm";
  const filePath = `episodes/${userId}/${Date.now()}-say.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(filePath, file, { contentType: file.type || "audio/webm" });
  if (uploadError) {
    return { error: `錄音上傳失敗：${uploadError.message}` };
  }

  const { data: urlData } = supabase.storage
    .from("audio")
    .getPublicUrl(filePath);

  const { data: episode, error: insertError } = await supabase
    .from("episodes")
    .insert({
      user_id: userId,
      title,
      audio_url: urlData.publicUrl,
      status: "uploaded",
      ...(workId ? { work_id: workId } : {}),
    })
    .select("id")
    .single();

  if (insertError || !episode) {
    return {
      error: `建立集數失敗：${insertError?.message ?? "unknown"}`,
    };
  }

  if (journalId) {
    // 連結失敗不擋錄音；署名會退回錄下時刻
    try {
      await linkJournalToEpisode(userId, journalId, episode.id);
    } catch (error) {
      console.error("[say] 連結視聽日誌失敗", {
        journalId,
        episodeId: episode.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { episodeId: episode.id };
}

/**
 * 轉錄完、送去整理之前：原話太少（錄不到人聲只轉出「.」）就不整理（UX-02）。
 * 這段錄音沒有內容可留，連同逐字稿與錄音檔一起刪（日誌紀錄回到「還沒說」），回說一段請他再說一次或改用打的。
 * 檢查本身失敗不擋流程：照常去校樣（校樣頁會再擋一次），並警報。
 */
export async function discardUnheardAction(episodeId: string): Promise<{ tooShort: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { tooShort: false, error: UNAUTHORIZED_MESSAGE };
  if (!UUID_PATTERN.test(episodeId)) return { tooShort: false, error: "episodeId 格式不正確" };

  const supabase = createAdminClient();
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("id")
    .eq("id", episodeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (episodeError || !episode) return { tooShort: false, error: "找不到集數" };

  const { data: transcript, error } = await supabase
    .from("transcripts")
    .select("full_text")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    await getServerNotify()("warn", "說一段：讀取逐字稿失敗，略過字數檢查", `episode=${episodeId} ${error.message}`).catch(() => undefined);
    return { tooShort: false };
  }
  if (!transcript || !isTooShortToGenerate(transcript.full_text)) return { tooShort: false };

  try {
    const deleted = await deleteDraft(userId, episodeId);
    if (!deleted.ok) console.error("[say] 刪除沒聽清楚的錄音失敗", { episodeId, error: deleted.error });
  } catch (cause) {
    await getServerNotify()(
      "warn",
      "說一段：刪除沒聽清楚的錄音失敗（留在編輯檯草稿）",
      `episode=${episodeId} ${cause instanceof Error ? cause.message : String(cause)}`,
    ).catch(() => undefined);
  }
  return { tooShort: true };
}
