/** 到期提醒的篩選與組裝（純函式）：repository 撈候選列，這裡決定誰該提醒、寫什麼 */

import { buildPlanCopy, buildReminderCopy } from "./remind";
import { logicalDayIndex, taipeiDateKey } from "./time";
import type { JournalStatus, Venue } from "./types";

export interface DueCandidateWork {
  title: string;
  kind: string;
  podcast_show: string | null;
}

export interface DueCandidateRow {
  id: string;
  /** 擁有者（013 之後由 repository 帶出；舊測試資料可省略） */
  user_id?: string;
  experienced_at: string;
  venue: Venue;
  status: JournalStatus;
  remind_at: string | null;
  reminded_at: string | null;
  work_title_fallback: string | null;
  /** 已連上說一段產生的文章；連上後就不再提醒（不論是否已發佈） */
  episode_id: string | null;
  /** PostgREST 多對一嵌入：物件；型別推斷有時給陣列，兩者都收 */
  works: DueCandidateWork | DueCandidateWork[] | null;
}

export interface DueReminder {
  journalEntryId: string;
  /** 這筆提醒的擁有者：worker 推播應只推給該使用者的訂閱 */
  userId: string;
  remindAt: string;
  /** 看／聽的時間：worker 合併同一位使用者的推播時挑最晚的那筆 */
  experiencedAt: string;
  title: string;
  body: string;
  /** 點通知要開的頁 */
  url: string;
  /** 省略＝say_reminder（想說說嗎）；plan_reminder＝排行程當天提醒；settle_prompt＝散場當下（migration 032） */
  kind?: "say_reminder" | "plan_reminder" | "settle_prompt";
  /** settle_prompt 專用：false＝深夜改隔天早上，只進收件匣不推播；省略＝照常推 */
  push?: boolean;
}

function pickWork(works: DueCandidateRow["works"]): DueCandidateWork | null {
  if (!works) return null;
  return Array.isArray(works) ? (works[0] ?? null) : works;
}

export function isDue(row: DueCandidateRow, now: Date): boolean {
  if (row.status !== "recorded" || row.reminded_at || !row.remind_at || row.episode_id) return false;
  return new Date(row.remind_at).getTime() <= now.getTime();
}

/** 排行程當天提醒：planned、remind_at 到期、還沒提醒過 */
export function isPlanDue(row: DueCandidateRow, now: Date): boolean {
  if (row.status !== "planned" || row.reminded_at || !row.remind_at) return false;
  return new Date(row.remind_at).getTime() <= now.getTime();
}

export function sayUrlFor(journalEntryId: string): string {
  return `/say?journal=${encodeURIComponent(journalEntryId)}`;
}

export function workTitleOf(row: Pick<DueCandidateRow, "works" | "work_title_fallback">): string {
  const work = pickWork(row.works);
  if (work?.kind === "podcast_episode" && work.podcast_show) return work.podcast_show;
  return work?.title ?? row.work_title_fallback ?? "";
}

export function kindOf(row: Pick<DueCandidateRow, "works">): string | null {
  return pickWork(row.works)?.kind ?? null;
}

/**
 * 同一天多筆合併成一則（設計 Token reminder.limit）：有一筆到期時，
 * 同一位使用者同一個邏輯日（4 點換日）還沒到期的紀錄一起帶出，worker 併進同一則推播，之後不再分開問。
 */
export function sameDaySiblings(
  due: readonly DueCandidateRow[],
  pending: readonly DueCandidateRow[],
  now: Date,
): DueCandidateRow[] {
  const dueDays = new Set(due.map((row) => `${row.user_id}:${logicalDayIndex(new Date(row.experienced_at))}`));
  return pending.filter(
    (row) =>
      row.status === "recorded" &&
      !row.reminded_at &&
      !row.episode_id &&
      row.remind_at !== null &&
      new Date(row.remind_at).getTime() > now.getTime() &&
      dueDays.has(`${row.user_id}:${logicalDayIndex(new Date(row.experienced_at))}`),
  );
}

/** 防禦性再篩一次（DB 條件與此一致），依 remind_at 舊到新 */
export function toDueReminders(rows: readonly DueCandidateRow[], now: Date): DueReminder[] {
  return buildDueReminders(rows.filter((row) => isDue(row, now)), now);
}

/** 組文案與網址（不再篩到期；同日提前帶出的紀錄也走這裡） */
export function buildDueReminders(rows: readonly DueCandidateRow[], now: Date): DueReminder[] {
  return [...rows]
    .sort((a, b) => (a.remind_at as string).localeCompare(b.remind_at as string))
    .map((row) => {
      const copy = buildReminderCopy({
        workTitle: workTitleOf(row),
        kind: kindOf(row),
        experiencedAt: new Date(row.experienced_at),
        venue: row.venue,
        askedAt: now,
      });
      return {
        journalEntryId: row.id,
        userId: row.user_id ?? "default",
        remindAt: row.remind_at as string,
        experiencedAt: row.experienced_at,
        title: copy.title,
        body: copy.body,
        url: sayUrlFor(row.id),
      };
    });
}

/** 排行程當天提醒：status=planned、remind_at 到期；點開日誌那一天 */
export function buildPlanReminders(rows: readonly DueCandidateRow[], now: Date): DueReminder[] {
  return [...rows]
    .filter((row) => isPlanDue(row, now))
    .sort((a, b) => (a.remind_at as string).localeCompare(b.remind_at as string))
    .map((row) => {
      const copy = buildPlanCopy({ workTitle: workTitleOf(row), kind: kindOf(row), venue: row.venue });
      return {
        journalEntryId: row.id,
        userId: row.user_id ?? "default",
        remindAt: row.remind_at as string,
        experiencedAt: row.experienced_at,
        title: copy.title,
        body: copy.body,
        url: `/journal?day=${taipeiDateKey(new Date(row.experienced_at))}`,
        kind: "plan_reminder" as const,
      };
    });
}
