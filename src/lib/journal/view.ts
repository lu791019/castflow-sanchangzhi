/**
 * 日誌頁（/journal）的檢視模型（純函式）：標題、meta、月份刊頭、月曆格、清單分組。
 * 日期歸屬用台北曆日（與 listJournalMonth 的月份範圍一致）；署名時間差見 byline.ts。
 */

import type { WorkKind } from "@/lib/works/format";
import { formatJournalByline } from "./byline";
import { pad2, taipeiDateKey, taipeiParts } from "./time";
import { VENUE_LABELS, type JournalStatus, type Venue } from "./types";
import { workCategory, type WorkCategory } from "./wording";

export interface JournalViewWork {
  kind: WorkKind;
  title: string;
  podcast_show: string | null;
  episode_number: number | null;
  poster_url: string | null;
}

export interface JournalViewArticle {
  /** 已發佈 → 分享頁；草稿 → 校樣頁 */
  href: string;
  saidAt: string;
  typed: boolean;
}

export interface JournalViewEntry {
  id: string;
  experiencedAt: string;
  venue: Venue;
  status: JournalStatus;
  companions: string | null;
  titleFallback: string | null;
  work: JournalViewWork | null;
  article: JournalViewArticle | null;
}

const CATEGORY_LABELS: Record<WorkCategory, string> = {
  screen: "影劇",
  podcast: "Podcast",
  music: "音樂",
  live: "演出",
  exhibition: "展覽",
};

const KIND_LABELS: Record<WorkKind, string> = {
  movie: "電影",
  series: "影集",
  podcast_episode: "Podcast",
  live: "演出",
  exhibition: "展覽",
  music: "音樂",
};

export function entryCategory(entry: JournalViewEntry): WorkCategory {
  return workCategory(entry.work?.kind ?? null, entry.venue);
}

/** 「慢慢說・第 121 集」「請回答1988・第 20 集」「海街日記」 */
export function entryTitle(entry: JournalViewEntry): string {
  const work = entry.work;
  if (!work) return entry.titleFallback ?? "（未命名）";
  const name = work.kind === "podcast_episode" && work.podcast_show ? work.podcast_show : work.title;
  const numbered = work.kind === "podcast_episode" || work.kind === "series";
  return numbered && work.episode_number ? `${name}・第 ${work.episode_number} 集` : name;
}

export function categoryLabel(entry: JournalViewEntry): string {
  return entry.work ? KIND_LABELS[entry.work.kind] : CATEGORY_LABELS[entryCategory(entry)];
}

/** 「電影・電影院」 */
export function entryMeta(entry: JournalViewEntry): string {
  return `${categoryLabel(entry)}・${VENUE_LABELS[entry.venue]}`;
}

export function entryTime(entry: JournalViewEntry): string {
  const { hour, minute } = taipeiParts(new Date(entry.experiencedAt));
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function entryByline(entry: JournalViewEntry): string {
  if (!entry.article) return "";
  try {
    return formatJournalByline({
      experiencedAt: entry.experiencedAt,
      venue: entry.venue,
      saidAt: entry.article.saidAt,
      verb: entry.work?.kind === "podcast_episode" || entry.work?.kind === "music" ? "聽完" : undefined,
      typed: entry.article.typed,
    });
  } catch {
    return "";
  }
}

// ── 月份刊頭 ────────────────────────────────────────────

export function monthStatLine(entries: readonly JournalViewEntry[]): string {
  if (entries.length === 0) return "這個月還沒有紀錄。";
  const count = (category: WorkCategory) => entries.filter((e) => entryCategory(e) === category).length;
  const watched = count("screen");
  const listened = count("podcast");
  const albums = count("music");
  const went = count("live") + count("exhibition");
  const parts = [
    watched ? `看了 ${watched} 部` : "",
    listened ? `聽了 ${listened} 集` : "",
    albums ? `聽了 ${albums} 張專輯` : "",
    went ? `去了 ${went} 場` : "",
  ].filter(Boolean);
  const said = entries.filter((e) => e.status === "said").length;
  const tail = said ? `其中 ${said} 筆，說成了文章。` : "";
  return `${parts.join("、")}。${tail}`;
}

export function monthSubLine(entries: readonly JournalViewEntry[]): string {
  if (entries.length === 0) return "第一筆會出現在這裡";
  const said = entries.filter((e) => e.status === "said").length;
  const head = `${entries.length} 筆紀錄`;
  return said ? `${head}・${said} 篇文章` : head;
}

export function monthTitle(month: string): { name: string; year: string } {
  const [year, m] = month.split("-");
  return { name: `${Number(m)} 月`, year };
}

/** "2026-01" ±n 個月 */
export function adjacentMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

// ── 月曆 ────────────────────────────────────────────

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
export const CALENDAR_MAX_MARKS = 3;

export interface CalendarDay {
  day: number;
  dateKey: string;
  weekday: string;
  count: number;
  /** 依時間先後，最多 3 個 */
  marks: WorkCategory[];
  hasArticle: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface CalendarMonth {
  /** 1 日前的空格數（週日起） */
  leading: number;
  days: CalendarDay[];
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function sortByTime(entries: readonly JournalViewEntry[], direction: 1 | -1): JournalViewEntry[] {
  return [...entries].sort((a, b) => direction * a.experiencedAt.localeCompare(b.experiencedAt));
}

function dateKeyOf(entry: JournalViewEntry): string {
  return taipeiDateKey(new Date(entry.experiencedAt));
}

export function buildCalendar(
  month: string,
  entries: readonly JournalViewEntry[],
  now: Date = new Date(),
): CalendarMonth {
  const [year, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const todayKey = taipeiDateKey(now);
  const sorted = sortByTime(entries, 1);
  const days = Array.from({ length: daysInMonth }, (_, index): CalendarDay => {
    const day = index + 1;
    const dateKey = `${year}-${pad2(m)}-${pad2(day)}`;
    const dayEntries = sorted.filter((entry) => dateKeyOf(entry) === dateKey);
    return {
      day,
      dateKey,
      weekday: `週${WEEKDAYS[weekdayOf(year, m, day)]}`,
      count: dayEntries.length,
      marks: dayEntries.slice(0, CALENDAR_MAX_MARKS).map(entryCategory),
      hasArticle: dayEntries.some((entry) => entry.status === "said"),
      isToday: dateKey === todayKey,
      isFuture: dateKey > todayKey,
    };
  });
  return { leading: weekdayOf(year, m, 1), days };
}

// ── 清單 ────────────────────────────────────────────

export interface DateGroup {
  dateKey: string;
  /** 10.08 */
  label: string;
  /** 週四 */
  weekday: string;
  entries: JournalViewEntry[];
}

export function groupByDate(entries: readonly JournalViewEntry[]): DateGroup[] {
  const sorted = sortByTime(entries, -1);
  const keys = [...new Set(sorted.map(dateKeyOf))];
  return keys.map((dateKey) => {
    const [year, m, d] = dateKey.split("-").map(Number);
    return {
      dateKey,
      label: `${pad2(m)}.${pad2(d)}`,
      weekday: `週${WEEKDAYS[weekdayOf(year, m, d)]}`,
      entries: sorted.filter((entry) => dateKeyOf(entry) === dateKey),
    };
  });
}

/** 還沒說的：status recorded，新到舊 */
/** 月份統計不算還沒發生的計畫 */
export function happenedEntries(entries: readonly JournalViewEntry[]): JournalViewEntry[] {
  return entries.filter((entry) => entry.status !== "planned");
}

export function pendingEntries(entries: readonly JournalViewEntry[]): JournalViewEntry[] {
  return sortByTime(
    entries.filter((entry) => entry.status === "recorded"),
    -1,
  );
}
