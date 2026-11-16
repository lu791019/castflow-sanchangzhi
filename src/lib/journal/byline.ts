/**
 * 署名時間差（設計稿「P1 元件特寫 04 新署名」）：
 * 格式 {日期}{時段或場域}{看完／聽完／逛完}・{時間差}{說的／寫的}
 * 例：「10.07 晚上看完・隔天說的」「10.07 晚上看完・散場後 18 分鐘說的」「10.05 在電影院看完・2 天後說的」
 * 時間差（台北時間，邏輯日 4 點換日）：
 * - 1 小時內：散場後 n 分鐘（劇場類），其他「看完後 n 分鐘」
 * - 同一邏輯日：當天{說的時段}
 * - 隔天／2 天後…6 天後／一週後／半個月後／n 個月後
 * 用打的把「說的」換成「寫的」。
 */

import { defaultVerb } from "./remind";
import { HOUR_MS, logicalDayIndex, MINUTE_MS } from "./time";
import type { Venue } from "./types";
import { dayPeriod, logicalDateLabel } from "./wording";

export { dayPeriod, type DayPeriod } from "./wording";

/** 有特定場域時優先寫場域；在家/其他寫時段 */
export const VENUE_PLACE: Partial<Record<Venue, string>> = {
  cinema: "在電影院",
  live: "在現場",
  exhibition: "在展場",
  commute: "通勤時",
};

const THEATRICAL_VENUES: ReadonlySet<Venue> = new Set(["cinema", "live", "exhibition"]);

export interface BylineInput {
  experiencedAt: Date | string;
  venue: Venue | null;
  saidAt: Date | string;
  /** 「看完／聽完／逛完」，預設依場域 */
  verb?: string;
  /** 用打的 → 「寫的」 */
  typed?: boolean;
}

function toDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} 不是有效時間`);
  }
  return date;
}

function experiencePrefix(experiencedAt: Date, venue: Venue, verb: string): string {
  const place = VENUE_PLACE[venue] ?? dayPeriod(experiencedAt);
  return `${logicalDateLabel(experiencedAt)} ${place}${verb}`;
}

function daysPhrase(days: number): string {
  if (days === 1) return "隔天";
  if (days < 7) return `${days} 天後`;
  if (days < 14) return "一週後";
  if (days < 30) return "半個月後";
  return `${Math.floor(days / 30)} 個月後`;
}

function gapPhrase(experiencedAt: Date, saidAt: Date, venue: Venue, verb: string): string {
  const elapsed = Math.max(0, saidAt.getTime() - experiencedAt.getTime());
  if (elapsed < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(elapsed / MINUTE_MS));
    const lead = THEATRICAL_VENUES.has(venue) ? "散場後" : `${verb}後`;
    return `${lead} ${minutes} 分鐘`;
  }
  const days = logicalDayIndex(saidAt) - logicalDayIndex(experiencedAt);
  return days <= 0 ? `當天${dayPeriod(saidAt)}` : daysPhrase(days);
}

export function formatJournalByline(input: BylineInput): string {
  const experiencedAt = toDate(input.experiencedAt, "experiencedAt");
  const saidAt = toDate(input.saidAt, "saidAt");
  const venue = input.venue ?? "other";
  const verb = input.verb ?? defaultVerb(venue);
  const said = input.typed ? "寫的" : "說的";
  return `${experiencePrefix(experiencedAt, venue, verb)}・${gapPhrase(experiencedAt, saidAt, venue, verb)}${said}`;
}
