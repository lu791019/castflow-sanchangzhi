/**
 * 單集閱讀頁的頁首資訊：集數、日期・長度・作者 meta 行。
 * 欄位處理以 design/data-feasibility.md 第三節為準——拿不到的不做假：
 * - 集數：RSS itunes:episode 缺就不顯示；有 itunes:season 時是季內集數 → 「S6・EP7」
 * - 作者：照實顯示 RSS author（單集層級優先，退回節目層級），不寫「主持人」
 */

import { formatDurationLabel } from "./duration";

export interface EpisodeNumbering {
  episodeNumber: number | null;
  seasonNumber: number | null;
}

function isPositiveInt(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** 集數標籤：S6・EP7 / EP703 / null（沒有集數就不顯示；只有季數也不顯示） */
export function episodeNumberLabel({ episodeNumber, seasonNumber }: EpisodeNumbering): string | null {
  if (!isPositiveInt(episodeNumber)) return null;
  return isPositiveInt(seasonNumber)
    ? `S${seasonNumber}・EP${episodeNumber}`
    : `EP${episodeNumber}`;
}

/** RSS 的正整數欄位（itunes:episode / itunes:season）；空、0、非整數 → null */
export function parsePositiveInt(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value > 0 && Number.isSafeInteger(value) ? value : null;
}

/** 播出日期：2026.10.03（台北時間；無法解析回 null） */
export function formatAiredDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

export interface EpisodeMetaInput extends EpisodeNumbering {
  airedAt: string | null;
  durationSeconds: number | null;
  author: string | null;
}

/** meta 行：S6・EP7・2026.10.03・48 分 12 秒・作者 The New York Times（缺的欄位直接略過） */
export function episodeMetaLine(input: EpisodeMetaInput): string {
  const author = input.author?.trim();
  return [
    episodeNumberLabel(input),
    formatAiredDate(input.airedAt),
    input.durationSeconds && input.durationSeconds > 0
      ? formatDurationLabel(input.durationSeconds)
      : null,
    author ? `作者 ${author}` : null,
  ]
    .filter(Boolean)
    .join("・");
}

/** 字卡用的大字：有集數顯示集數，否則不顯示 */
export function coverCardNumber(input: EpisodeNumbering): string | null {
  return isPositiveInt(input.episodeNumber) ? String(input.episodeNumber) : null;
}
