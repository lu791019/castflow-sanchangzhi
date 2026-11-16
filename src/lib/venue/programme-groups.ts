/**
 * 場刊分組（純函式）：Token time.week「場外＝同一場的同一晚，展覽以展期計」。
 * - 演出：以看完的邏輯日（4 點換日，半夜散場仍算那一晚）分組，新的一晚在前；第幾晚依時間順序
 * - 展覽：整個展期一組
 * 感受列含匿名署名；印章列（這場散場的人）只放以筆名署名的人，同一人只出現一次，最多十人。
 */

import { HOUR_MS, logicalDayIndex, MINUTE_MS } from "@/lib/journal/time";
import { dayPeriod, logicalDateLabel } from "@/lib/journal/wording";
import type { LiveKind } from "./match";

/** cast.row：超過十人以「和另外 N 人」收合 */
export const PEOPLE_ROW_MAX = 10;

export interface ProgrammeFeeling {
  episodeId: string;
  shareSlug: string;
  title: string;
  pullQuote: string | null;
  /** 顯示名（匿名署名為「匿名」） */
  author: string;
  /** 以筆名署名才有；匿名為 null（不露印章、不進印章列） */
  penName: string | null;
  glyph: string | null;
  /** 說的時刻（episode 建立） */
  createdAt: string;
  publishedAt: string;
  /** 連到的日誌「看完」時刻；直接說一段的為 null */
  experiencedAt: string | null;
  typed: boolean;
}

export interface ProgrammePerson {
  penName: string;
  glyph: string | null;
}

export interface ProgrammeGroup {
  key: number;
  label: string;
  dateLabel: string;
  feelings: ProgrammeFeeling[];
  people: ProgrammePerson[];
  morePeople: number;
}

function sortTime(feeling: ProgrammeFeeling): Date {
  return new Date(feeling.experiencedAt ?? feeling.createdAt);
}

function gapPhrase(from: Date, to: Date): string {
  const elapsed = Math.max(0, to.getTime() - from.getTime());
  if (elapsed < HOUR_MS) return `${Math.max(1, Math.floor(elapsed / MINUTE_MS))} 分鐘後`;
  const days = logicalDayIndex(to) - logicalDayIndex(from);
  if (days <= 0) return dayPeriod(from) === "晚上" || dayPeriod(from) === "深夜" ? "當晚" : "當天";
  if (days === 1) return "隔天";
  if (days < 7) return `${days} 天後`;
  return days < 14 ? "一週後" : "隔了一陣子";
}

/** 署名小字：「10.10 散場・18 分鐘後說的」「10.06 下午看完・隔天說的」 */
export function feelingSig(feeling: ProgrammeFeeling, kind: LiveKind): string {
  const said = feeling.typed ? "寫的" : "說的";
  const saidAt = new Date(feeling.createdAt);
  if (!feeling.experiencedAt) return `${logicalDateLabel(saidAt)} ${said}`;
  const seen = new Date(feeling.experiencedAt);
  const lead = kind === "live" ? `${logicalDateLabel(seen)} 散場` : `${logicalDateLabel(seen)} ${dayPeriod(seen)}看完`;
  return `${lead}・${gapPhrase(seen, saidAt)}${said}`;
}

function peopleOf(feelings: readonly ProgrammeFeeling[]): ProgrammePerson[] {
  const seen = new Set<string>();
  return feelings.flatMap((feeling) => {
    if (!feeling.penName || seen.has(feeling.penName)) return [];
    seen.add(feeling.penName);
    return [{ penName: feeling.penName, glyph: feeling.glyph }];
  });
}

function buildGroup(key: number, label: string, dateLabel: string, feelings: ProgrammeFeeling[]): ProgrammeGroup {
  const people = peopleOf(feelings);
  return {
    key,
    label,
    dateLabel,
    feelings,
    people: people.slice(0, PEOPLE_ROW_MAX),
    morePeople: Math.max(0, people.length - PEOPLE_ROW_MAX),
  };
}

function nightLabel(order: number, total: number): string {
  if (total === 1) return "當晚";
  return `第 ${order + 1} 晚`;
}

/** 日期範圍小字：09.20 – 10.06（同一天只寫一次） */
function spanLabel(first: Date, last: Date): string {
  const a = logicalDateLabel(first);
  const b = logicalDateLabel(last);
  return a === b ? a : `${a} – ${b}`;
}

export function groupProgramme(
  feelings: readonly ProgrammeFeeling[],
  kind: LiveKind,
  now: Date,
  exhibitionLabel = "展期中",
): ProgrammeGroup[] {
  const sorted = [...feelings].sort((a, b) => sortTime(b).getTime() - sortTime(a).getTime());
  if (sorted.length === 0) return [];
  if (kind === "exhibition") {
    const label = spanLabel(sortTime(sorted[sorted.length - 1]), sortTime(sorted[0]));
    return [buildGroup(0, exhibitionLabel, label, sorted)];
  }
  const nights = [...new Set(sorted.map((feeling) => logicalDayIndex(sortTime(feeling))))];
  const today = logicalDayIndex(now);
  return nights.map((night, index) => {
    const rows = sorted.filter((feeling) => logicalDayIndex(sortTime(feeling)) === night);
    const date = logicalDateLabel(sortTime(rows[0]));
    const order = nights.length - 1 - index;
    return buildGroup(night, nightLabel(order, nights.length), night === today ? `${date}・今晚` : date, rows);
  });
}

