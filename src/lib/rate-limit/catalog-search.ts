/** 索引搜尋（/catalog?q=）的 per-IP 限流：文章正文走 ilike 全表掃描，擋住連打（每 IP 每分鐘 20 次） */

import { createRateLimiter } from "./token-bucket";

export const CATALOG_SEARCH_LIMIT_PER_MINUTE = 20;

const limiter = createRateLimiter({ capacity: CATALOG_SEARCH_LIMIT_PER_MINUTE, windowMs: 60_000 });

export function allowCatalogSearch(ip: string): boolean {
  const result = limiter.take(`catalog-search:${ip}`);
  if (!result.allowed) console.warn("[rate-limit] 索引搜尋超過每分鐘上限", { ip, retryAfterMs: result.retryAfterMs });
  return result.allowed;
}
