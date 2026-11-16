/** /api/resonance 請求驗證（純函式） */

import { isPassageHash } from "./passage";

const SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export type ResonanceRequest = { ok: true; slug: string; hash: string } | { ok: false; error: string };

export function parseResonanceRequest(body: unknown): ResonanceRequest {
  if (!body || typeof body !== "object") return { ok: false, error: "請求格式不正確" };
  const { slug, hash } = body as Record<string, unknown>;
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) return { ok: false, error: "找不到這篇" };
  if (!isPassageHash(hash)) return { ok: false, error: "找不到這段" };
  return { ok: true, slug, hash };
}
