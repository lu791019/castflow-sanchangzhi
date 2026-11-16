/** 同好配對卡的文案（純函式）：數字一律阿拉伯數字 */

import { SHOWN_TITLES } from "./constants";

export function matchHeading(matches: ReadonlyArray<{ commonCount: number }>): string {
  const most = Math.max(0, ...matches.map((match) => match.commonCount));
  // 只靠「寫得像」配到、沒有任何共同作品時，不能寫「同樣 0 部」
  return most > 0 ? `有人跟你看了同樣 ${most} 部` : "有人寫的東西跟你很像";
}

export function matchMeta(match: { commonCount: number; titles: readonly string[] }): string {
  const titles = match.titles.slice(0, SHOWN_TITLES).map((title) => `《${title}》`).join("");
  return titles ? `同樣 ${match.commonCount} 部・${titles}` : `同樣 ${match.commonCount} 部`;
}

/** 「你們寫的東西很像」＋對方最像的那篇標題 */
export function similarReason(title: string | null): string {
  const clean = title?.trim();
  return clean ? `你們寫的東西很像・〈${clean}〉` : "你們寫的東西很像";
}

/** 卡片上的配對理由（每行一條）：有共同作品先寫作品，寫得像再加一行 */
export function matchReasons(match: { commonCount: number; titles: readonly string[]; similarTitle: string | null }): string[] {
  return [
    ...(match.commonCount > 0 ? [matchMeta(match)] : []),
    ...(match.similarTitle !== null ? [similarReason(match.similarTitle)] : []),
  ];
}
