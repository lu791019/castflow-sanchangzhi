/** 場刊手填封面的邊界驗證（純函式）：上傳檔看檔頭判類型、限大小；貼網址只收 http(s) */

import { safeImageUrl } from "./cover";

export const COVER_MAX_BYTES = 3 * 1024 * 1024;
export const COVER_URL_MAX_LENGTH = 2000;

export interface CoverFileType {
  ext: "jpg" | "png" | "webp";
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const SIGNATURE_BYTES = 12;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** 看檔頭：JPEG FF D8 FF、PNG 89 50 4E 47 0D 0A 1A 0A、WebP RIFF....WEBP */
export function sniffImageType(bytes: Uint8Array): CoverFileType | null {
  if (bytes.length < SIGNATURE_BYTES) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", contentType: "image/jpeg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", contentType: "image/png" };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export function validateCoverUpload(head: Uint8Array, size: number): Result<CoverFileType> {
  if (size <= 0) return { ok: false, error: "沒有收到圖片" };
  if (size > COVER_MAX_BYTES) return { ok: false, error: "圖片不可超過 3MB" };
  const type = sniffImageType(head);
  return type ? { ok: true, value: type } : { ok: false, error: "只收 JPG、PNG、WebP 圖片" };
}

/**
 * body.liveCoverUrl：沒填回 null。外部網址只收 https（http 在正式站是混合內容、也是明碼）；
 * 上傳後拿到的自家 Storage 網址（trustedPrefix，本地開發是 http）照收。
 */
export function parseCoverUrl(value: unknown, trustedPrefix: string | null = null): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "封面網址必須是文字" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > COVER_URL_MAX_LENGTH) return { ok: false, error: `封面網址不可超過 ${COVER_URL_MAX_LENGTH} 字` };
  const url = safeImageUrl(trimmed);
  const trusted = trustedPrefix !== null && url?.startsWith(trustedPrefix);
  return url && (trusted || url.startsWith("https://"))
    ? { ok: true, value: url }
    : { ok: false, error: "封面網址要是 https 開頭" };
}
