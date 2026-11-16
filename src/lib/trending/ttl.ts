/**
 * 本週熱門快取時間：預設一小時。
 * 本機 E2E 可用 TRENDING_CACHE_TTL_MS 調短（各 spec 的假榜單不同，一小時快取會讓前一支 spec 的榜單留到下一支）；
 * 跟其他外部網址覆寫一樣，正式環境不吃（見 lib/e2e-overrides）。
 */

import { externalOverridesAllowed } from "@/lib/e2e-overrides";

export const TRENDING_TTL_MS = 60 * 60_000;

export function trendingTtlFromEnv(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.TRENDING_CACHE_TTL_MS?.trim();
  if (!raw || !externalOverridesAllowed(env)) return TRENDING_TTL_MS;
  const ttl = Number(raw);
  return Number.isFinite(ttl) && ttl >= 0 ? ttl : TRENDING_TTL_MS;
}
