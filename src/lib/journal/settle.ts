/**
 * 散場當下提醒（Q-37／Q-25「找不到使用時機」）：排了行程的人，在散場那一刻問一句（純函式）。
 * - 散場時間 estimateSettleAt：電影＝場次＋片長＋15 分；演出＋150 分；展覽＋90 分；影集、Podcast 不提醒
 * - 到點判斷 settleDecision：散場後 2 小時內推一次；深夜 23:30–08:00 不推，改隔天 09:00 收件匣一則
 * 與 settlePlans（場次＋4h 轉 recorded）獨立計算，互不影響。
 */

import { fromTaipei, HOUR_MS, MINUTE_MS, taipeiParts } from "./time";
import type { Venue } from "./types";

/** 所有可調常數集中於此 */
export const SETTLE_TIMING = {
  /** works 沒有片長時的電影預設長度（分） */
  movieDefaultRuntimeMin: 130,
  /** 片尾、離場的緩衝（分） */
  movieBufferMin: 15,
  liveMin: 150,
  exhibitionMin: 90,
  /** 散場後多久內還算「當下」 */
  windowMs: 2 * HOUR_MS,
  /** 深夜不推：台北 23:30 起到 08:00 */
  nightStartMinute: 23 * 60 + 30,
  nightEndMinute: 8 * 60,
  /** 深夜散場改隔天早上這個時刻進收件匣 */
  morningHour: 9,
  /** 早上那則最晚補到幾點（worker 停機時不無限補） */
  morningGraceMs: 12 * HOUR_MS,
} as const;

export type SettleCategory = "movie" | "live" | "exhibition";

export interface SettleEntryInput {
  experienced_at: string;
  venue: Venue;
}

export interface SettleWorkInput {
  kind: string;
  /** TMDB 片長（分，migration 032）；沒有就用預設 */
  runtime_minutes?: number | null;
}

/** 依作品類型（沒作品看場域）決定要不要提醒；null＝不提醒（影集、Podcast、在家、通勤…） */
export function settleCategory(venue: Venue, work: SettleWorkInput | null): SettleCategory | null {
  if (work) {
    if (work.kind === "movie") return "movie";
    if (work.kind === "live") return "live";
    if (work.kind === "exhibition") return "exhibition";
    return null;
  }
  if (venue === "cinema") return "movie";
  if (venue === "live") return "live";
  if (venue === "exhibition") return "exhibition";
  return null;
}

function movieRuntime(work: SettleWorkInput | null): number {
  const runtime = work?.runtime_minutes;
  return typeof runtime === "number" && Number.isFinite(runtime) && runtime > 0
    ? runtime
    : SETTLE_TIMING.movieDefaultRuntimeMin;
}

function durationMinutes(category: SettleCategory, work: SettleWorkInput | null): number {
  switch (category) {
    case "movie":
      return movieRuntime(work) + SETTLE_TIMING.movieBufferMin;
    case "live":
      return SETTLE_TIMING.liveMin;
    case "exhibition":
      return SETTLE_TIMING.exhibitionMin;
  }
}

/** 散場時間；不該提醒或時間無效回 null（UTC 毫秒相加，跨午夜自然正確） */
export function estimateSettleAt(entry: SettleEntryInput, work: SettleWorkInput | null): Date | null {
  const start = new Date(entry.experienced_at);
  if (Number.isNaN(start.getTime())) return null;
  const category = settleCategory(entry.venue, work);
  if (!category) return null;
  return new Date(start.getTime() + durationMinutes(category, work) * MINUTE_MS);
}

/** 台北 23:30–08:00 */
export function isSettleNight(date: Date): boolean {
  const { hour, minute } = taipeiParts(date);
  const minutes = hour * 60 + minute;
  return minutes >= SETTLE_TIMING.nightStartMinute || minutes < SETTLE_TIMING.nightEndMinute;
}

/** 深夜散場的下一個早上 09:00（凌晨散場＝當天，午夜前散場＝隔天） */
function morningAfter(settleAt: Date): Date {
  const { year, month, day, hour } = taipeiParts(settleAt);
  const sameDay = fromTaipei(year, month, day, SETTLE_TIMING.morningHour);
  return hour < SETTLE_TIMING.morningHour ? sameDay : fromTaipei(year, month, day + 1, SETTLE_TIMING.morningHour);
}

export type SettleDecision =
  | { type: "wait" }
  | { type: "expired" }
  | { type: "push" }
  | { type: "morning"; at: Date };

/**
 * 這一輪該怎麼處理：
 * - push：散場後 2 小時內、且現在不是深夜 → 收件匣＋推播
 * - morning：散場窗口碰到深夜（散場或窗口尾端落在 23:30–08:00）→ 隔天 09:00 起只進收件匣
 * - wait／expired：還沒到／過了（白天場錯過不補「昨晚」）
 */
export function settleDecision(settleAt: Date, now: Date): SettleDecision {
  const t = now.getTime();
  if (t < settleAt.getTime()) return { type: "wait" };
  const windowEnd = new Date(settleAt.getTime() + SETTLE_TIMING.windowMs);
  if (t <= windowEnd.getTime() && !isSettleNight(now)) return { type: "push" };
  const nightTouched = isSettleNight(settleAt) || isSettleNight(windowEnd);
  if (!nightTouched) return t > windowEnd.getTime() ? { type: "expired" } : { type: "wait" };
  const morning = morningAfter(settleAt);
  if (t < morning.getTime()) return { type: "wait" };
  if (t <= morning.getTime() + SETTLE_TIMING.morningGraceMs) return { type: "morning", at: morning };
  return { type: "expired" };
}

export interface SettleCopyInput {
  workTitle: string;
  kind: string | null;
  venue: Venue;
}

export interface SettleCopy {
  title: string;
  body: string;
}

/** Q-56：錄音不是唯一入口，提醒也講可以用打的 */
export const SAY_CALL_TO_ACTION = "說一段，或打幾句。";

/** 站上慣例：演出直接寫名字，其餘加書名號 */
function quotedName(input: SettleCopyInput): string {
  const name = input.workTitle.trim();
  if (!name) return "那一場";
  const isLive = input.kind === "live" || (!input.kind && input.venue === "live");
  return isLive ? name : `《${name}》`;
}

function isExhibition(input: SettleCopyInput): boolean {
  return input.kind === "exhibition" || (!input.kind && input.venue === "exhibition");
}

/** 推播與收件匣同一則：散場了？／《作品》剛結束。說一段，或打幾句。 */
export function buildSettleCopy(input: SettleCopyInput): SettleCopy {
  const name = quotedName(input);
  if (isExhibition(input)) return { title: "逛完了？", body: `${name}逛完了。${SAY_CALL_TO_ACTION}` };
  return { title: "散場了？", body: `${name}剛結束。${SAY_CALL_TO_ACTION}` };
}

/** 深夜散場改隔天早上：昨晚的《作品》，還記得什麼嗎？ */
export function buildSettleMorningCopy(input: SettleCopyInput): SettleCopy {
  return { title: `昨晚的${quotedName(input)}，還記得什麼嗎？`, body: SAY_CALL_TO_ACTION };
}
