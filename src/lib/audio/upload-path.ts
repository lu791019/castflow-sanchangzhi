/**
 * 上傳音檔的儲存路徑規則（純函式）。
 * 路徑一律 `episodes/{uid}/{timestamp}-{safeName}`：server 簽發上傳網址時決定路徑，
 * 建立集數時再驗證路徑屬於呼叫者，避免拿別人的檔案建集數。
 */

const UPLOAD_PREFIX = "episodes";
const MAX_FILE_NAME_LENGTH = 120;
const FALLBACK_FILE_NAME = "audio";
export const MAX_EPISODE_TITLE_LENGTH = 200;

function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-MAX_FILE_NAME_LENGTH);
  return cleaned.replace(/^\.+/, "") || FALLBACK_FILE_NAME;
}

export function buildAudioUploadPath(userId: string, fileName: string, now: number): string {
  return `${UPLOAD_PREFIX}/${userId}/${now}-${safeFileName(fileName)}`;
}

export function isOwnAudioUploadPath(userId: string, path: string): boolean {
  const prefix = `${UPLOAD_PREFIX}/${userId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return /^\d+-[a-zA-Z0-9._-]+$/.test(rest) && !rest.includes("..");
}

export type TitleValidation = { ok: true; title: string } | { ok: false; error: string };

export function validateEpisodeTitle(input: unknown): TitleValidation {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "請輸入集數標題" };
  }
  const title = input.trim();
  if (title.length > MAX_EPISODE_TITLE_LENGTH) {
    return { ok: false, error: `標題不能超過 ${MAX_EPISODE_TITLE_LENGTH} 字` };
  }
  return { ok: true, title };
}

const PUBLIC_AUDIO_MARKER = "/storage/v1/object/public/audio/";

/**
 * 從 episodes.audio_url 取回 audio 儲存桶內的路徑；外部網址（RSS）或格式不符回 null。
 * audio_url 仍存公開網址格式當識別，儲存桶本身是 private，讀取時再換簽名網址。
 */
export function storedAudioPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const index = url.indexOf(PUBLIC_AUDIO_MARKER);
  if (index < 0) return null;
  const path = decodeURIComponent(url.slice(index + PUBLIC_AUDIO_MARKER.length).split(/[?#]/)[0]);
  return path && !path.split("/").includes("..") ? path : null;
}

/** 從錄音公開網址取回儲存路徑；不是自己的上傳路徑（或格式不符）回 null，避免刪到別人的檔案 */
export function audioPathFromPublicUrl(userId: string, url: string | null | undefined): string | null {
  const path = storedAudioPath(url);
  return path && isOwnAudioUploadPath(userId, path) ? path : null;
}
