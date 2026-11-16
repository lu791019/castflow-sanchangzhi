/** /api/works/search、/api/works/episodes 的 per-IP 限流（每 IP 每分鐘 30 次），超過回 429 JSON */

import { NextResponse } from "next/server";
import { clientIp, createRateLimiter } from "./token-bucket";

export const WORKS_API_LIMIT_PER_MINUTE = 30;

const limiter = createRateLimiter({ capacity: WORKS_API_LIMIT_PER_MINUTE, windowMs: 60_000 });

export function rateLimitedResponse(retryAfterMs: number, message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}

/** 超過回 429 response；未超過回 null。search 與 episodes 各自一桶 */
export function limitWorksApi(request: Request, scope: string): NextResponse | null {
  const ip = clientIp(request.headers);
  const result = limiter.take(`${scope}:${ip}`);
  if (result.allowed) return null;
  console.warn("[rate-limit] works API 超過每分鐘上限", { scope, ip, retryAfterMs: result.retryAfterMs });
  return rateLimitedResponse(result.retryAfterMs, "查得太快了，稍等一下再試");
}
