/** 文章匯入的每人限流：預覽（抓網頁＋LLM）每小時 20 篇；送出另一桶，同樣 20 篇。超過回 429 JSON */

import type { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit/token-bucket";
import { rateLimitedResponse } from "@/lib/rate-limit/works-api";

export const IMPORTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60_000;

const previewLimiter = createRateLimiter({ capacity: IMPORTS_PER_HOUR, windowMs: HOUR_MS });
const commitLimiter = createRateLimiter({ capacity: IMPORTS_PER_HOUR, windowMs: HOUR_MS });

function limit(limiter: typeof previewLimiter, userId: string, scope: string): NextResponse | null {
  const result = limiter.take(userId);
  if (result.allowed) return null;
  console.warn(`[rate-limit] 文章匯入${scope}超過每小時上限`, { userId, retryAfterMs: result.retryAfterMs });
  return rateLimitedResponse(result.retryAfterMs, `一小時最多搬 ${IMPORTS_PER_HOUR} 篇，晚點再試`);
}

export function limitImportPreview(userId: string): NextResponse | null {
  return limit(previewLimiter, userId, "預覽");
}

export function limitImportCommit(userId: string): NextResponse | null {
  return limit(commitLimiter, userId, "送出");
}
