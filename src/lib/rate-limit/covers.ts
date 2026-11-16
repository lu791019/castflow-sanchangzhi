/** 封面上傳的每人限流：每小時 20 張；超過回 429 JSON */

import type { NextResponse } from "next/server";
import { createRateLimiter } from "./token-bucket";
import { rateLimitedResponse } from "./works-api";

export const COVER_UPLOADS_PER_HOUR = 20;

const uploadLimiter = createRateLimiter({ capacity: COVER_UPLOADS_PER_HOUR, windowMs: 60 * 60_000 });

export function limitCoverUpload(userId: string): NextResponse | null {
  const result = uploadLimiter.take(userId);
  if (result.allowed) return null;
  console.warn("[rate-limit] 封面上傳超過每小時上限", { userId, retryAfterMs: result.retryAfterMs });
  return rateLimitedResponse(result.retryAfterMs, "傳得有點多，晚點再試");
}
