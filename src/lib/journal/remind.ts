/** 提醒時間計算與提醒文案（純函式） */

import { fromTaipei, HOUR_MS, logicalDayParts, taipeiParts } from "./time";
import type { ReminderTiming, Venue } from "./types";
import { cjkSpacing } from "@/lib/format/digits";
import { gapPhrase, logicalDaysBetween, relativeDayWord, workCategory } from "./wording";

export const REMIND_NOON_HOUR = 12;
export const HALF_DAY_MS = 12 * HOUR_MS;
/** 半天後提醒的安靜時段：23:00–9:00 不問，延到早上 9 點 */
export const QUIET_START_HOUR = 23;
export const QUIET_END_HOUR = 9;

function deferQuietHours(date: Date): Date {
  const { year, month, day, hour } = taipeiParts(date);
  if (hour >= QUIET_START_HOUR) return fromTaipei(year, month, day + 1, QUIET_END_HOUR);
  if (hour < QUIET_END_HOUR) return fromTaipei(year, month, day, QUIET_END_HOUR);
  return date;
}

/**
 * 依提醒設定算 remind_at（以使用者記的 experienced_at 為準）：
 * - next_noon：邏輯日（4 點換日）的隔天 12:00（台北）。半夜 1 點看完 → 當天中午
 * - half_day：experienced_at + 12 小時；落在 23:00–9:00 改到早上 9 點
 * - off：不提醒
 * 補記很久以前的紀錄時 remind_at 可能已過去 → worker 下一輪就會提醒，屬預期行為。
 */
export function computeRemindAt(experiencedAt: Date, timing: ReminderTiming): Date | null {
  if (Number.isNaN(experiencedAt.getTime())) {
    throw new Error("experienced_at 不是有效時間");
  }
  switch (timing) {
    case "off":
      return null;
    case "half_day":
      return deferQuietHours(new Date(experiencedAt.getTime() + HALF_DAY_MS));
    case "next_noon": {
      const { year, month, day } = logicalDayParts(experiencedAt);
      return fromTaipei(year, month, day + 1, REMIND_NOON_HOUR);
    }
  }
}

/** 排行程：當天早上 9 點提醒「今天的場」；場次比 9 點還早就提前一小時 */
export const PLAN_REMIND_HOUR = 9;
/** 場次開始後多久視為「散場」，把計畫轉成已看並接上「想說說嗎？」 */
export const PLAN_SETTLE_DELAY_MS = 4 * HOUR_MS;

export function planRemindAt(experiencedAt: Date): Date {
  const { year, month, day } = taipeiParts(experiencedAt);
  const morning = fromTaipei(year, month, day, PLAN_REMIND_HOUR);
  return morning.getTime() < experiencedAt.getTime() ? morning : new Date(experiencedAt.getTime() - HOUR_MS);
}

export interface PlanCopyInput {
  workTitle: string;
  kind: string | null;
  venue: Venue;
}

/** 當天提醒文案：像朋友早上提一句，不催 */
export function buildPlanCopy(input: PlanCopyInput): ReminderCopy {
  const name = input.workTitle.trim() || "那一場";
  switch (workCategory(input.kind, input.venue)) {
    case "podcast":
    case "music":
      return { title: `今天要聽的《${name}》`, body: "聽完回來說一句就好。" };
    case "live":
      return { title: `今天的${name}`, body: "散場之後，回來說一句就好。" };
    case "exhibition":
      return { title: `今天去看《${name}》`, body: "逛完回來說一句就好。" };
    case "screen":
      return { title: `今天的《${name}》`, body: "散場之後，回來說一句就好。" };
  }
}

export interface ReminderCopyInput {
  workTitle: string;
  /** works.kind；只記名稱時為 null，改看場域 */
  kind: string | null;
  experiencedAt: Date;
  venue: Venue;
  /** 問的時刻（推播送出／通知建立），用來寫「昨晚」「週六」 */
  askedAt: Date;
}

export interface ReminderCopy {
  title: string;
  body: string;
}

/**
 * 推播文案（設計稿「推播 · 文案依類型」）：標題＝時間＋作品，內文像朋友隔天隨口問。
 * 不用驚嘆號、不倒數、不提連續天數。
 */
export function buildReminderCopy(input: ReminderCopyInput): ReminderCopy {
  const name = input.workTitle.trim() || "那部作品";
  const when = relativeDayWord(input.experiencedAt, input.askedAt);
  const gap = gapPhrase(logicalDaysBetween(input.experiencedAt, input.askedAt));
  switch (workCategory(input.kind, input.venue)) {
    case "podcast":
      return {
        title: `${when}${input.venue === "commute" ? "通勤" : ""}聽的《${name}》`,
        body: "那一集還在你腦子裡嗎？想到什麼就說什麼。",
      };
    case "music":
      return { title: `${when}聽的《${name}》`, body: "哪一首還在腦子裡轉？想到什麼就說什麼。" };
    case "live":
      return { title: `${when}的${name}`, body: cjkSpacing(`隔了${gap}，最記得的是哪一首？`) };
    case "exhibition":
      return { title: `${when}看的《${name}》`, body: "有沒有哪一張，現在還想得起來？" };
    case "screen":
      return { title: `${when}的《${name}》`, body: cjkSpacing(`看完${gap}了，現在想說說嗎？說一分鐘就好。`) };
  }
}

export type ReminderQuestionInput = Omit<ReminderCopyInput, "workTitle">;

/** 收件匣未處理列：標題後接的一句提問（比推播內文短） */
export function reminderQuestion(input: ReminderQuestionInput): string {
  const gap = gapPhrase(logicalDaysBetween(input.experiencedAt, input.askedAt));
  switch (workCategory(input.kind, input.venue)) {
    case "podcast":
      return "那一集還在你腦子裡嗎？";
    case "music":
      return "哪一首還在腦子裡轉？";
    case "live":
      return cjkSpacing(`隔了${gap}，最記得的是哪一首？`);
    case "exhibition":
      return "有沒有哪一張，現在還想得起來？";
    case "screen":
      return "現在想說說嗎？";
  }
}

/** 看完／聽完／逛完（設計稿署名格式） */
export function defaultVerb(venue: Venue): string {
  if (venue === "live") return "聽完";
  if (venue === "exhibition") return "逛完";
  return "看完";
}

export interface TimingCopy {
  /** 記一筆 sheet 底部小字 */
  hint: string;
  /** 記下後 toast 的後半句 */
  toast: string;
}

/** 記一筆的提醒說明，依使用者的提醒設定 */
export function timingCopy(timing: ReminderTiming): TimingCopy {
  switch (timing) {
    case "next_noon":
      return { hint: "明天中午會問你想不想說說。可以在設定裡改。", toast: "明天中午會問你。" };
    case "half_day":
      return { hint: "半天後會問你想不想說說。可以在設定裡改。", toast: "半天後會問你。" };
    case "off":
      return { hint: "不會提醒你，想說的時候再回來。可以在設定裡改。", toast: "想說的時候再回來。" };
  }
}
