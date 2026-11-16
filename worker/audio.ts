import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const CLIP_TIMEOUT_MS = 60_000;
const COMPRESS_TIMEOUT_MS = 10 * 60_000;

/** Groq Whisper 單檔上限 */
export const GROQ_MAX_BYTES = 25 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
};

export function guessExtension(url: string, contentType: string | null): string {
  if (contentType) {
    const base = contentType.split(";")[0].trim().toLowerCase();
    if (EXTENSION_BY_CONTENT_TYPE[base]) return EXTENSION_BY_CONTENT_TYPE[base];
  }
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (/^\.(mp3|m4a|aac|wav|webm|ogg|flac|mp4)$/.test(ext)) return ext;
  } catch {
    // URL 解析失敗時走預設
  }
  return ".mp3";
}

/** 下載音訊到本機暫存目錄；podcast CDN 多層 redirect，交給 fetch 跟隨 */
export async function downloadAudio(url: string, destDir: string): Promise<string> {
  await mkdir(destDir, { recursive: true });
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`下載音訊失敗：HTTP ${response.status}`);
  }
  const extension = guessExtension(url, response.headers.get("content-type"));
  const filePath = path.join(destDir, `episode-${Date.now()}${extension}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error("下載音訊失敗：檔案為空");
  }
  await writeFile(filePath, buffer);
  return filePath;
}

/** 裁前 N 秒（stream copy 不重編碼），驗證/試跑用 */
export async function clipAudio(srcPath: string, seconds: number): Promise<string> {
  const extension = path.extname(srcPath);
  const outPath = srcPath.replace(
    new RegExp(`${extension.replace(".", "\\.")}$`),
    `-clip${seconds}s${extension}`,
  );
  await execFileAsync(
    "ffmpeg",
    ["-y", "-i", srcPath, "-t", String(seconds), "-c", "copy", outPath],
    { timeout: CLIP_TIMEOUT_MS },
  );
  return outPath;
}

export interface GroqAudio {
  path: string;
  compressed: boolean;
}

/**
 * Groq 上限 25MB：超過就重編碼成 16kHz 單聲道 32kbps mp3（約 14MB/小時）。
 * 壓完仍超過代表節目過長，直接丟錯走降級警報，不靜默截斷內容。
 */
export async function prepareForGroq(
  srcPath: string,
  { maxBytes = GROQ_MAX_BYTES }: { maxBytes?: number } = {},
): Promise<GroqAudio> {
  const originalSize = (await stat(srcPath)).size;
  if (originalSize <= maxBytes) {
    return { path: srcPath, compressed: false };
  }

  const outPath = srcPath.replace(/\.[^./]+$/, "") + "-groq.mp3";
  await execFileAsync(
    "ffmpeg",
    ["-y", "-i", srcPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", outPath],
    { timeout: COMPRESS_TIMEOUT_MS },
  );

  const compressedSize = (await stat(outPath)).size;
  if (compressedSize > maxBytes) {
    throw new Error(
      `音訊壓縮後仍超過 Groq 上限（${(compressedSize / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(1)}MB）`,
    );
  }
  return { path: outPath, compressed: true };
}
