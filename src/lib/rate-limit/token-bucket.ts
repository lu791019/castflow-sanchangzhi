/**
 * 記憶體 token bucket（單一 server process 內有效；多實例部署時各自計數，屬簡易防護）。
 * capacity 顆，桶第一次被取用起每 windowMs 一次補滿（interval refill）。
 * 不用連續補充：連續補充下慢速連打（例：每次 500ms）永遠打不滿，與「每分鐘 30 次」的直覺不符。
 */

export interface RateLimitResult {
  allowed: boolean;
  /** 被拒時建議幾毫秒後重試；允許時為 0 */
  retryAfterMs: number;
  remaining: number;
}

export interface RateLimiter {
  take: (key: string) => RateLimitResult;
  /** 只看不扣 */
  peek: (key: string) => number;
}

export interface RateLimiterOptions {
  capacity: number;
  windowMs: number;
  now?: () => number;
  /** key 數上限，超過先清掉已補滿的（避免 IP 無限增長） */
  maxKeys?: number;
}

interface Bucket {
  tokens: number;
  /** 本輪視窗起點；過了 windowMs 補滿並重開視窗 */
  windowStart: number;
}

const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter({
  capacity,
  windowMs,
  now = Date.now,
  maxKeys = DEFAULT_MAX_KEYS,
}: RateLimiterOptions): RateLimiter {
  if (capacity <= 0 || windowMs <= 0) throw new Error("capacity 與 windowMs 必須為正數");
  const buckets = new Map<string, Bucket>();

  function current(key: string, at: number): Bucket {
    const bucket = buckets.get(key);
    if (!bucket || at - bucket.windowStart >= windowMs) return { tokens: capacity, windowStart: at };
    return bucket;
  }

  function prune(at: number): void {
    if (buckets.size < maxKeys) return;
    for (const [key] of buckets) {
      if (current(key, at).tokens >= capacity) buckets.delete(key);
    }
    // 全部都還在冷卻：丟最舊的，維持上限
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    take: (key) => {
      const at = now();
      const bucket = current(key, at);
      if (bucket.tokens >= 1) {
        if (!buckets.has(key)) prune(at);
        buckets.set(key, { ...bucket, tokens: bucket.tokens - 1 });
        return { allowed: true, retryAfterMs: 0, remaining: bucket.tokens - 1 };
      }
      return { allowed: false, retryAfterMs: bucket.windowStart + windowMs - at, remaining: 0 };
    },
    peek: (key) => current(key, now()).tokens,
  };
}

/** 取 client IP：x-forwarded-for 第一個 → x-real-ip → "unknown"（全部共用一桶） */
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || "unknown";
}
