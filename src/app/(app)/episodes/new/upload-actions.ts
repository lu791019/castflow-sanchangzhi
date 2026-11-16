"use server";

/**
 * 上傳音檔建集數（取代瀏覽器端 anon client 直寫 storage 與 episodes）。
 * 1. createAudioUploadAction：server 決定路徑（使用者自己的目錄），用 service role 簽一次性上傳網址
 * 2. 瀏覽器把檔案 PUT 到簽好的網址（不經 Next server，避免 body 大小限制）
 * 3. createUploadedEpisodeAction：驗證路徑屬於呼叫者且檔案真的存在，再以 service role 建集數
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import {
  buildAudioUploadPath,
  isOwnAudioUploadPath,
  validateEpisodeTitle,
} from "@/lib/audio/upload-path";

const AUDIO_BUCKET = "audio";

type UploadTarget = { path: string; signedUrl: string } | { error: string };

export async function createAudioUploadAction(fileName: string): Promise<UploadTarget> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };
  if (typeof fileName !== "string") return { error: "缺少檔名" };

  const path = buildAudioUploadPath(userId, fileName, Date.now());
  const { data, error } = await createAdminClient()
    .storage.from(AUDIO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[upload] createSignedUploadUrl failed", { path, message: error?.message });
    return { error: "無法建立上傳網址，請稍後再試" };
  }
  return { path, signedUrl: data.signedUrl };
}

/** 檔案是否真的已上傳（list 該目錄找檔名） */
async function uploadedFileExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await createAdminClient()
    .storage.from(AUDIO_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  if (error) {
    console.error("[upload] list failed", { path, message: error.message });
    return false;
  }
  return (data ?? []).some((file) => file.name === path.slice(slash + 1));
}

export async function createUploadedEpisodeAction(
  rawTitle: string,
  path: string,
): Promise<{ episodeId: string } | { error: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: UNAUTHORIZED_MESSAGE };

  const title = validateEpisodeTitle(rawTitle);
  if (!title.ok) return { error: title.error };
  if (typeof path !== "string" || !isOwnAudioUploadPath(userId, path)) {
    return { error: "上傳路徑不正確" };
  }
  if (!(await uploadedFileExists(path))) return { error: "找不到已上傳的音檔" };

  const supabase = createAdminClient();
  const { data: urlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
  const { data: episode, error } = await supabase
    .from("episodes")
    .insert({
      user_id: userId,
      title: title.title,
      audio_url: urlData.publicUrl,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !episode) {
    console.error("[upload] insert episode failed", { message: error?.message });
    return { error: "建立集數失敗" };
  }
  return { episodeId: episode.id };
}
