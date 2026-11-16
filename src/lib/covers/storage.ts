/**
 * 場刊封面上傳（server only，service role）：寫進公開讀的 `covers` 桶。
 * 路徑只用隨機 id（u/<uuid>），公開網址不帶使用者 id，避免從封面反查是誰上傳的。
 */

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CoverFileType } from "./upload";

export const COVERS_BUCKET = "covers";

/** 自家 Storage 的封面公開網址前綴（記一筆送回來時據此認得是上傳的圖） */
export function coversPublicPrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/${COVERS_BUCKET}/` : null;
}

export async function uploadCover(userId: string, bytes: Uint8Array, type: CoverFileType): Promise<string> {
  const storage = createAdminClient().storage.from(COVERS_BUCKET);
  const path = `u/${randomUUID()}.${type.ext}`;
  const { error } = await storage.upload(path, bytes, { contentType: type.contentType, upsert: false });
  if (error) {
    console.error("[covers] upload failed", { userId, path, message: error.message });
    throw new Error("上傳封面失敗");
  }
  return storage.getPublicUrl(path).data.publicUrl;
}
