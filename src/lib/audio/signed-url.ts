/**
 * audio 儲存桶是 private：episodes.audio_url 存的是公開網址格式（當識別用），
 * 要播放或下載時換成短效簽名網址。外部網址（RSS 節目音檔）原樣回傳。
 * 只接 storage 介面，app（service role）與本機 worker 共用。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { storedAudioPath } from "./upload-path.ts";

const AUDIO_BUCKET = "audio";
/** 校樣頁播放原音：頁面可能開著一段時間 */
export const PLAYBACK_URL_TTL_SECONDS = 2 * 60 * 60;
/** 轉錄下載：拿到就立刻抓 */
export const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;

export async function signStoredAudioUrl(
  client: Pick<SupabaseClient, "storage">,
  url: string,
  ttlSeconds: number,
): Promise<string> {
  const path = storedAudioPath(url);
  if (!path) return url;
  const { data, error } = await client.storage.from(AUDIO_BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`簽發錄音網址失敗：${error?.message ?? "no url"}`);
  }
  return data.signedUrl;
}
