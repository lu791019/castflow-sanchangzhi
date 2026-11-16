/** 回信 API 的每人限流：寄信每小時 10 封、作者動作每分鐘 60 次；超過回 429 JSON */

import type { NextResponse } from "next/server";
import { createRateLimiter } from "./token-bucket";
import { rateLimitedResponse } from "./works-api";

export const LETTER_SEND_PER_HOUR = 10;
export const LETTER_ACTIONS_PER_MINUTE = 60;

const sendLimiter = createRateLimiter({ capacity: LETTER_SEND_PER_HOUR, windowMs: 60 * 60_000 });
const actionLimiter = createRateLimiter({ capacity: LETTER_ACTIONS_PER_MINUTE, windowMs: 60_000 });

export function limitLetterSend(userId: string): NextResponse | null {
  const result = sendLimiter.take(userId);
  if (result.allowed) return null;
  console.warn("[rate-limit] 寄信超過每小時上限", { userId, retryAfterMs: result.retryAfterMs });
  return rateLimitedResponse(result.retryAfterMs, "寄得有點快，休息一下再寫");
}

export function limitLetterAction(userId: string): NextResponse | null {
  const result = actionLimiter.take(userId);
  if (result.allowed) return null;
  console.warn("[rate-limit] 來信操作超過每分鐘上限", { userId, retryAfterMs: result.retryAfterMs });
  return rateLimitedResponse(result.retryAfterMs, "操作太快了，稍等一下再試");
}
