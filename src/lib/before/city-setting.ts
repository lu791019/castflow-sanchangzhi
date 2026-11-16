/**
 * 散場之前「在哪個縣市」的記憶（純函式）：存在既有 settings 表（每人一列，key = before_city:<userId>，
 * 同 taste_picks:<userId> 的寫法），換裝置也記得；不加 migration。值 { city: "臺北市" | null }，null＝全部縣市。
 */

import { normalizeCity } from "@/lib/events/city";

export const BEFORE_CITY_KEY = "before_city";

export function beforeCityKey(userId: string): string {
  return `${BEFORE_CITY_KEY}:${userId}`;
}

/** settings.value → 縣市；壞資料當全部縣市 */
export function parseStoredCity(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  return normalizeCity((value as { city?: unknown }).city);
}

export type CityBody = { ok: true; city: string | null } | { ok: false };

/** POST body：{ city: 22 縣市之一 | null }；不在白名單不收 */
export function parseCityBody(body: unknown): CityBody {
  if (!body || typeof body !== "object" || !("city" in body)) return { ok: false };
  const raw = (body as { city: unknown }).city;
  if (raw === null) return { ok: true, city: null };
  const city = normalizeCity(raw);
  return city ? { ok: true, city } : { ok: false };
}
