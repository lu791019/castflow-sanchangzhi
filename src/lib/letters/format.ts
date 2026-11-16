/** 回信的日期與文案（台北時間；數字一律阿拉伯數字） */

import { pad2, taipeiParts, type TaipeiParts } from "@/lib/journal/time";

export type LetterStatus = "none" | "published" | "kept";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const INVALID = "—";

function partsOf(iso: string): TaipeiParts | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : taipeiParts(date);
}

function periodOf(hour: number): string {
  if (hour < 5) return "凌晨";
  if (hour < 12) return "上午";
  if (hour < 13) return "中午";
  if (hour < 18) return "下午";
  return "晚上";
}

/** 列表日期：10.10 */
export function letterDay(iso: string): string {
  const parts = partsOf(iso);
  return parts ? `${pad2(parts.month)}.${pad2(parts.day)}` : INVALID;
}

/** 單封時間：10.10 週六・上午 09:12 */
export function letterTime(iso: string): string {
  const parts = partsOf(iso);
  if (!parts) return INVALID;
  const weekday = WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
  const clock = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  return `${pad2(parts.month)}.${pad2(parts.day)} 週${weekday}・${periodOf(parts.hour)} ${clock}`;
}

/** 已刊登大章的日期：10.10 */
export function stampDate(iso: string): string {
  const parts = partsOf(iso);
  if (!parts) return INVALID;
  return `${pad2(parts.month)}.${pad2(parts.day)}`;
}

/** 來信頁標題：3 封信，1 封還沒拆。 */
export function inboxStatLine(total: number, unread: number): string {
  const head = `${total} 封信`;
  if (unread <= 0) return total === 1 ? `${head}，讀過了。` : `${head}，都讀過了。`;
  if (unread >= total) return total === 1 ? `${head}，還沒拆。` : `${head}，都還沒拆。`;
  return `${head}，${unread} 封還沒拆。`;
}

/** 列表狀態小字；還沒決定時不顯示 */
export function letterNote(status: LetterStatus, hasReply: boolean): string | null {
  if (status === "published") return hasReply ? "你回覆了" : "在文章末尾";
  if (status === "kept") return "只放在這裡";
  return null;
}

/** 寄出後收成的一行 */
export function sentLine(sentAt: string, authorName: string): string {
  return `你在 ${letterDay(sentAt)} 寄了一封信給${authorName}。`;
}

/** 讀者來函右上：作者選刊・2 封 */
export function publishedCountLabel(count: number): string {
  return `作者選刊・${count} 封`;
}

/** 「來信」入口的讀螢幕名稱（未讀點本身 aria-hidden） */
export function lettersTabLabel(unread: number): string {
  return unread > 0 ? `來信，${unread} 封未讀` : "來信";
}
