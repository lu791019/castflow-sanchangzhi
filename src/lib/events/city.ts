/**
 * 散場之前「在哪個縣市」（純函式）：縣市白名單與正規化、活動只留該縣市的場次、30 天內有出門類活動的縣市排序。
 * 縣市一律寫「臺」（地址、使用者輸入的「台」先正規化）。
 */

import { CITIES } from "./collected";
import { sessionsInWindow, type CultureEvent } from "./culture";

export const TAIWAN_CITIES: readonly string[] = CITIES;

/** 白名單內的縣市（台 → 臺）；其他一律 null */
export function normalizeCity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const city = value.trim().replaceAll("台", "臺");
  return TAIWAN_CITIES.includes(city) ? city : null;
}

/** 沒選縣市原樣；選了就只留該縣市的場次（巡演只剩那一站），沒有場次在該縣市的活動拿掉 */
export function narrowToCity<T extends CultureEvent>(events: readonly T[], city: string | null): T[] {
  if (!city) return [...events];
  return events.flatMap((event) => {
    const sessions = event.sessions.filter((session) => session.city === city);
    return sessions.length > 0 ? [{ ...event, sessions }] : [];
  });
}

/** 30 天內有出門類活動的縣市：活動數多的在前（同一活動在一個縣市只算一次），同數照縣市順序 */
export function rankCities(events: readonly CultureEvent[], today: string): string[] {
  const counts = events.reduce((map, event) => {
    const cities = new Set(sessionsInWindow(event, today).flatMap((session) => (session.city ? [session.city] : [])));
    cities.forEach((city) => map.set(city, (map.get(city) ?? 0) + 1));
    return map;
  }, new Map<string, number>());
  return TAIWAN_CITIES.filter((city) => counts.has(city)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
}

/** 市縣同名：縣保留「縣」才分得出來 */
const KEEP_COUNTY = new Set(["新竹縣", "嘉義縣"]);

/** 卡片 meta 的縣市簡稱：去掉「市／縣」（臺北、高雄、宜蘭）；新竹縣、嘉義縣保留全名 */
export function cityShortName(city: string): string {
  return KEEP_COUNTY.has(city) ? city : city.replace(/[市縣]$/u, "");
}
