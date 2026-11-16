/**
 * 場刊頁（設計稿「P3 場外 A 音樂祭／B 展覽」）的畫面資料（純函式）。
 * 沒有外部資料源：場地、日期都是第一位記下的人手寫；不列時間、主辦、售票。
 * 數字一律阿拉伯數字（10/11 Dex 拍板）；字卡直排日期由元件把 1–2 位數字併成一格。
 */

import { monthDayText } from "@/lib/format/digits";
import { logicalDayParts, pad2, taipeiParts } from "@/lib/journal/time";
import { formatIssueLatin, formatIssueNo, relativeTimeLabel, stripWorkTitle, type Work } from "@/lib/works/format";
import { logicalDateKey } from "./input";
import { feelingSig, groupProgramme, type ProgrammeFeeling, type ProgrammePerson } from "./programme-groups";
import { splitProgrammeTitle } from "./name";

export type ProgrammeWork = Pick<Work, "id" | "title" | "slug" | "issue_no"> & {
  kind: "live" | "exhibition";
  venue: string | null;
  event_date: string | null;
  event_end_date: string | null;
  /** 封面（讀者手填或上傳，migration 029 前就有的欄位）；沒有走字卡 */
  poster_url?: string | null;
};

export interface ProgrammeRow {
  episodeId: string;
  shareSlug: string;
  author: string;
  penName: string | null;
  glyph: string | null;
  sig: string;
  title: string;
  pullQuote: string | null;
}

export interface ProgrammeGroupView {
  key: number;
  label: string;
  dateLabel: string;
  /** 印章列小標：人數 */
  countLabel: string;
  /** 感受列小標：段數 */
  feelingCountLabel: string;
  people: ProgrammePerson[];
  morePeople: number;
  rows: ProgrammeRow[];
}

export interface ProgrammeView {
  kind: "live" | "exhibition";
  posterUrl: string | null;
  eyebrow: string;
  issue: string;
  titleLines: string[];
  plate: string;
  plateMark: string;
  facts: Array<{ label: string; value: string }>;
  stamp: { date: string; time: string | null } | null;
  stats: Array<{ label: string; value: string; big: boolean }>;
  peopleTitle: string;
  peopleDek: string;
  groups: ProgrammeGroupView[];
  countTitle: string;
  infoTitle: string;
  info: Array<{ label: string; value: string; href: string | null }>;
  cta: { kicker: string; lines: [string, string]; body: string; sub: string };
  footNo: string;
  footLine: string;
  footMonth: string;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const DAY_MS = 24 * 60 * 60 * 1000;

function dateParts(iso: string): { year: number; month: number; day: number; weekday: string } {
  const time = Date.parse(`${iso}T00:00:00Z`);
  const date = new Date(time);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: WEEKDAYS[date.getUTCDay()],
  };
}

/** 2026.10.09（五）– 10.10（六）；展期不帶星期；跨年寫完整年份 */
export function formatProgrammeDates(start: string | null, end: string | null, weekday: boolean): string | null {
  if (!start) return null;
  const a = dateParts(start);
  const mark = (p: ReturnType<typeof dateParts>) => (weekday ? `（${p.weekday}）` : "");
  const head = `${a.year}.${pad2(a.month)}.${pad2(a.day)}${mark(a)}`;
  if (!end || end === start) return head;
  const b = dateParts(end);
  const tailYear = b.year === a.year ? "" : `${b.year}.`;
  return `${head}${weekday ? "" : " "}– ${tailYear}${pad2(b.month)}.${pad2(b.day)}${mark(b)}`;
}

function plateDates(start: string, end: string | null): string {
  const a = dateParts(start);
  const first = monthDayText(a.month, a.day);
  if (!end || end === start) return first;
  const b = dateParts(end);
  return b.month === a.month ? `${first}・${b.day} 日` : `${first}・${monthDayText(b.month, b.day)}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

type Phase = { state: "before" | "running" | "ended"; daysLeft: number };

function phaseOf(work: ProgrammeWork, today: string): Phase {
  const start = work.event_date ?? today;
  const end = work.event_end_date ?? start;
  if (today < start) return { state: "before", daysLeft: daysBetween(today, end) };
  if (today > end) return { state: "ended", daysLeft: 0 };
  return { state: "running", daysLeft: daysBetween(today, end) };
}

function exhibitionPlateMark(phase: Phase): string {
  if (phase.state === "ended") return "已閉展";
  if (phase.state === "before") return "即將開展";
  return phase.daysLeft === 0 ? "展期中・今天最後一天" : `展期中・還有 ${phase.daysLeft} 天`;
}

function hhmm(iso: string): string {
  const { hour, minute } = taipeiParts(new Date(iso));
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** 已散場戳：演出最後一晚有人散場（或已過）；展覽閉展後 */
function stampOf(work: ProgrammeWork, feelings: readonly ProgrammeFeeling[], today: string, phase: Phase): ProgrammeView["stamp"] {
  const lastDay = work.event_end_date ?? work.event_date;
  if (!lastDay) return null;
  const { month, day } = dateParts(lastDay);
  const date = `${pad2(month)}.${pad2(day)}`;
  if (work.kind === "exhibition") return phase.state === "ended" ? { date, time: null } : null;
  const lastNight = feelings
    .flatMap((feeling) => (feeling.experiencedAt ? [feeling.experiencedAt] : []))
    .filter((at) => logicalDateKey(new Date(at)) === lastDay)
    .sort();
  if (lastNight.length > 0) return { date, time: hhmm(lastNight[0]) };
  return today > lastDay ? { date, time: null } : null;
}

function peopleDek(kind: ProgrammeWork["kind"], nights: number, people: number, phase: Phase): string {
  if (kind === "exhibition") {
    if (people === 0) return "還沒有人說過這檔展。第一段，可以是你的。";
    return phase.state === "ended"
      ? "展期結束了。走出過這個展間的人，都排在這裡。"
      : "展期還沒結束。之後走出這個展間的人，也會排在這裡。";
  }
  if (people === 0) return "還沒有人說過這一場。第一段，可以是你的。";
  const when = nights > 1 ? `${nights} 個晚上` : "那個晚上";
  return people === 1 ? `${when}，一個人待到散場，說了一段。` : `${when}，${people} 個人待到散場，各自說了一段。`;
}

function monthLabel(now: Date): string {
  const { year, month } = logicalDayParts(now);
  return `${year}.${pad2(month)}`;
}

function mapsHref(venue: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

export function buildProgramme(work: ProgrammeWork, feelings: readonly ProgrammeFeeling[], now: Date): ProgrammeView {
  const live = work.kind === "live";
  const today = logicalDateKey(now);
  const phase = phaseOf(work, today);
  const groups = groupProgramme(feelings, work.kind, now, phase.state === "ended" ? "展期" : "展期中");
  const people = new Set(feelings.flatMap((feeling) => (feeling.penName ? [feeling.penName] : []))).size;
  const latest = [...feelings].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const count = feelings.length;
  const title = splitProgrammeTitle(work.title);
  const multiDay = Boolean(work.event_end_date && work.event_end_date !== work.event_date);
  const dates = formatProgrammeDates(work.event_date, work.event_end_date, live);
  const dateLabel = live ? "日期" : "展期";

  return {
    kind: work.kind,
    posterUrl: work.poster_url ?? null,
    eyebrow: live ? (multiDay ? "場外・音樂祭" : "場外・演出") : "場外・展覽",
    issue: `場刊 ${formatIssueNo(work.issue_no)}`,
    titleLines: title.lines,
    plate: title.plate,
    plateMark: live ? (work.event_date ? plateDates(work.event_date, work.event_end_date) : "場外") : exhibitionPlateMark(phase),
    facts: [
      work.venue ? { label: "場地", value: work.venue } : null,
      dates ? { label: dateLabel, value: dates } : null,
    ].filter((fact): fact is { label: string; value: string } => fact !== null),
    stamp: stampOf(work, feelings, today, phase),
    stats: [
      { label: "收錄", value: `${count} 段感受`, big: true },
      live
        ? { label: "同場", value: count === 0 ? "—" : `${groups.length} 晚 ${people} 人`, big: false }
        : { label: "看過的人", value: `${people} 人`, big: false },
      { label: "最近一段", value: latest ? relativeTimeLabel(latest.publishedAt, now) : "—", big: false },
    ],
    peopleTitle: live ? "這場散場的人" : "看過這檔展的人",
    peopleDek: peopleDek(work.kind, groups.length, people, phase),
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      dateLabel: group.dateLabel,
      countLabel: `${group.people.length + group.morePeople} 人`,
      feelingCountLabel: `${group.feelings.length} 段`,
      people: group.people,
      morePeople: group.morePeople,
      rows: group.feelings.map((feeling) => ({
        episodeId: feeling.episodeId,
        shareSlug: feeling.shareSlug,
        author: feeling.author,
        penName: feeling.penName,
        glyph: feeling.glyph,
        sig: feelingSig(feeling, work.kind),
        title: stripWorkTitle(feeling.title, work.title),
        pullQuote: feeling.pullQuote,
      })),
    })),
    countTitle: `${count} 段感受`,
    infoTitle: live ? "演出資訊" : "展覽資訊",
    info: [
      work.venue ? { label: "場地", value: work.venue, href: mapsHref(work.venue) } : null,
      dates ? { label: dateLabel, value: dates, href: null } : null,
    ].filter((row): row is { label: string; value: string; href: string | null } => row !== null),
    cta: {
      kicker: `第 ${count + 1} 段，可以是你的`,
      lines: live ? ["你也在", "那一場？"] : ["你也看過", "這檔展？"],
      body: live
        ? "說一段散場時的事。它會被排進這本場刊，和那晚一起走出來的人放在一起。"
        : phase.state === "running" && phase.daysLeft > 0
          ? `展期還有 ${phase.daysLeft} 天。看完走出展間的那一刻，說一段。`
          : "看完走出展間的那一刻，說一段。",
      sub: `已帶入「${work.title}」`,
    },
    footNo: `場刊 No.${formatIssueLatin(work.issue_no)}`,
    footLine: `「${work.title}」・${count > 0 ? `收錄 ${count} 段感受` : "等待第一段"}`,
    footMonth: monthLabel(now),
  };
}
