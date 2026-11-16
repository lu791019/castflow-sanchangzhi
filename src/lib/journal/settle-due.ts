/**
 * 散場當下提醒的候選篩選與組裝（純函式）：repository 撈近 36 小時的計畫，這裡決定誰到點、寫什麼。
 * 去重靠 notifications(journal_entry_id, kind) unique＋這裡排除已建過的；不寫 reminded_at（那是當天提醒與「想說說嗎」用的）。
 */

import { sayUrlFor, type DueReminder } from "./due";
import { buildSettleCopy, buildSettleMorningCopy, estimateSettleAt, settleDecision } from "./settle";
import { logicalDayIndex } from "./time";
import type { JournalStatus, Venue } from "./types";
import { FUTURE_TOLERANCE_MS } from "./validate";

export interface SettleCandidateWork {
  title: string;
  kind: string;
  podcast_show: string | null;
  runtime_minutes?: number | null;
}

export interface SettleCandidateRow {
  id: string;
  user_id: string;
  work_id: string | null;
  experienced_at: string;
  created_at: string;
  venue: Venue;
  status: JournalStatus;
  episode_id: string | null;
  work_title_fallback: string | null;
  /** PostgREST 多對一嵌入：物件；型別推斷有時給陣列，兩者都收 */
  works: SettleCandidateWork | SettleCandidateWork[] | null;
}

/** 使用者已經說過的痕跡（有內容的日誌、或自己寫的文章），at＝那天的時間 */
export interface SaidMark {
  userId: string;
  workId: string | null;
  titleFallback?: string | null;
  at: string;
}

export interface SettleContext {
  /** 已建過 settle_prompt 的條目 */
  notified: ReadonlySet<string>;
  said: readonly SaidMark[];
}

function pickWork(works: SettleCandidateRow["works"]): SettleCandidateWork | null {
  if (!works) return null;
  return Array.isArray(works) ? (works[0] ?? null) : works;
}

/**
 * 排行程＝紀錄建立時場次還在未來（與記一筆判 planned 同一個 10 分鐘容差）；
 * 事後補記、「剛剛」記下的不算（散場已過，問「散場了？」沒有意義）
 */
export function isPlannedAhead(row: Pick<SettleCandidateRow, "created_at" | "experienced_at">): boolean {
  return new Date(row.created_at).getTime() + FUTURE_TOLERANCE_MS < new Date(row.experienced_at).getTime();
}

function workKey(workId: string | null, titleFallback: string | null | undefined): string | null {
  if (workId) return `w:${workId}`;
  const title = titleFallback?.trim();
  return title ? `t:${title}` : null;
}

function saidKeys(said: readonly SaidMark[]): Set<string> {
  const keys = new Set<string>();
  for (const mark of said) {
    const key = workKey(mark.workId, mark.titleFallback);
    if (key) keys.add(`${mark.userId}|${key}|${logicalDayIndex(new Date(mark.at))}`);
  }
  return keys;
}

function alreadySaid(row: SettleCandidateRow, keys: ReadonlySet<string>): boolean {
  const key = workKey(row.work_id, row.work_title_fallback);
  if (!key) return false;
  return keys.has(`${row.user_id}|${key}|${logicalDayIndex(new Date(row.experienced_at))}`);
}

function isOpen(row: SettleCandidateRow): boolean {
  return (row.status === "planned" || row.status === "recorded") && !row.episode_id;
}

function displayTitle(row: SettleCandidateRow, work: SettleCandidateWork | null): string {
  if (work?.kind === "podcast_episode" && work.podcast_show) return work.podcast_show;
  return work?.title ?? row.work_title_fallback ?? "";
}

function toPrompt(row: SettleCandidateRow, now: Date): DueReminder | null {
  const work = pickWork(row.works);
  const settleAt = estimateSettleAt(row, work);
  if (!settleAt) return null;
  const decision = settleDecision(settleAt, now);
  if (decision.type !== "push" && decision.type !== "morning") return null;
  const copyInput = { workTitle: displayTitle(row, work), kind: work?.kind ?? null, venue: row.venue };
  const copy = decision.type === "push" ? buildSettleCopy(copyInput) : buildSettleMorningCopy(copyInput);
  return {
    journalEntryId: row.id,
    userId: row.user_id,
    remindAt: (decision.type === "morning" ? decision.at : settleAt).toISOString(),
    experiencedAt: row.experienced_at,
    title: copy.title,
    body: copy.body,
    url: sayUrlFor(row.id),
    kind: "settle_prompt",
    push: decision.type === "push",
  };
}

/** 到點、沒建過、還沒說過的排行程 → settle_prompt；依 remindAt 舊到新 */
export function buildSettlePrompts(
  rows: readonly SettleCandidateRow[],
  context: SettleContext,
  now: Date,
): DueReminder[] {
  const keys = saidKeys(context.said);
  return rows
    .filter((row) => isOpen(row) && isPlannedAhead(row) && !context.notified.has(row.id) && !alreadySaid(row, keys))
    .map((row) => toPrompt(row, now))
    .filter((prompt): prompt is DueReminder => prompt !== null)
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
}
