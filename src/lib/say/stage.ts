/** 說一段：標題推導、計時與「散場後」標籤的純邏輯 */

const TITLE_MAX = 30;

/** 送出時的集數標題：有作品卡用「剛看完《作品》」，否則取首句（上限 30 字） */
export function deriveSayTitle(text: string, workTitle: string | null): string {
  if (workTitle) return `剛看完《${workTitle}》`;
  const firstSentence = text
    .trim()
    .split(/(?<=[。！？!?])|\n/)[0]
    ?.trim();
  if (firstSentence) return firstSentence.slice(0, TITLE_MAX);
  return "散場隨筆";
}

/** 錄音計時：0:42 */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** 「散場後 N 分鐘」：依最近一集建立時間推算 */
export function minutesSinceLabel(iso: string, now: Date): string {
  const elapsedMs = now.getTime() - new Date(iso).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return "剛散場";
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "剛散場";
  if (minutes < 60) return `散場後 ${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `散場後 ${hours} 小時`;
  return `散場後 ${Math.floor(hours / 24)} 天`;
}
