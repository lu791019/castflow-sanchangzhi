/**
 * 收件匣檢視模型（純函式）：通知列 + 連到的日誌紀錄 → 分組（今天／這週稍早／更早）與每列文案。
 * 標題以「問的時刻」（通知建立時間）重算，與推播一致；舊通知的固定標題只在沒有紀錄時使用。
 * 可操作（說說看／只記不說）＝ 未讀 且 紀錄仍是「還沒說」。
 */

import { sayUrlFor } from "@/lib/journal/due";
import { buildReminderCopy, reminderQuestion } from "@/lib/journal/remind";
import { pad2, taipeiDateKey, taipeiParts } from "@/lib/journal/time";
import { VENUE_LABELS, type JournalStatus, type Venue } from "@/lib/journal/types";
import type { JournalViewWork } from "@/lib/journal/view";
import { dayPeriod, logicalDateLabel, logicalDaysBetween } from "@/lib/journal/wording";

export interface InboxEntrySource {
  id: string;
  experiencedAt: string;
  venue: Venue;
  status: JournalStatus;
  titleFallback: string | null;
  work: JournalViewWork | null;
}

export interface InboxSource {
  id: string;
  /**
   * 省略＝say_reminder；plan_reminder＝排行程當天提醒（用存下的標題，不可操作）；
   * settle_prompt＝散場當下（用存下的標題＋內文，可操作，說說看＝推播點開的同一個說一段）
   * listen_prompt＝Spotify 聽完一張專輯（Q-64 C1，沒有紀錄；記一筆＝url，預選那張專輯）
   */
  kind?: "say_reminder" | "plan_reminder" | "settle_prompt" | "listen_prompt";
  /** listen_prompt：點了去哪（只收 /journal/new 開頭的站內網址） */
  url?: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  entry: InboxEntrySource | null;
}

export type InboxResult = "pending" | "said" | "skipped" | "planned";

export interface InboxItem {
  id: string;
  journalId: string | null;
  line: string;
  meta: string;
  unread: boolean;
  actionable: boolean;
  result: InboxResult;
  cover: "poster" | "plate";
  posterUrl: string | null;
  sayHref: string | null;
  /** 沒有紀錄的提醒（listen_prompt）：「記一筆」去哪；其他 null */
  logHref: string | null;
}

export type InboxSectionKey = "today" | "week" | "older";

export interface InboxSection {
  key: InboxSectionKey;
  label: string;
  items: InboxItem[];
}

export interface InboxView {
  sections: InboxSection[];
  unreadCount: number;
}

const SECTION_LABELS: Record<InboxSectionKey, string> = {
  today: "今天",
  week: "這週稍早",
  older: "更早",
};

const SHORT_VENUE: Record<Venue, string> = { ...VENUE_LABELS, live: "演出", exhibition: "展覽" };

function clock(date: Date): string {
  const { hour, minute } = taipeiParts(date);
  return `${pad2(hour)}:${pad2(minute)}`;
}

function askedLabel(askedAt: Date, now: Date): string {
  const today = taipeiDateKey(now);
  const yesterday = taipeiDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const key = taipeiDateKey(askedAt);
  if (key === today) return `今天 ${clock(askedAt)}`;
  if (key === yesterday) return `昨天 ${clock(askedAt)}`;
  const { month, day } = taipeiParts(askedAt);
  return `${pad2(month)}.${pad2(day)} ${clock(askedAt)}`;
}

function workName(entry: InboxEntrySource): string {
  const work = entry.work;
  if (!work) return entry.titleFallback ?? "";
  return work.kind === "podcast_episode" && work.podcast_show ? work.podcast_show : work.title;
}

function episodeSuffix(work: JournalViewWork | null): string {
  if (!work?.episode_number) return "";
  return work.kind === "podcast_episode" || work.kind === "series" ? `第 ${work.episode_number} 集` : "";
}

function resultOf(status: JournalStatus | undefined): InboxResult {
  if (status === "said") return "said";
  if (status === "skipped") return "skipped";
  return "pending";
}

function askedStamp(askedAt: Date): string {
  const { month, day } = taipeiParts(askedAt);
  return `${pad2(month)}.${pad2(day)} ${clock(askedAt)} 問的`;
}

/** 收聽提醒的連結只收站內記一筆（DB 另有 check，這裡再擋一次，不讓存下的網址把人帶出站） */
const LISTEN_URL = /^\/journal\/new\?[\w=&%.-]+$/;

export function safeListenUrl(url: string | null | undefined): string | null {
  return url && LISTEN_URL.test(url) ? url : null;
}

/** Spotify 聽完一張專輯（沒有紀錄）：未讀＝可操作（記一筆／不用了），讀過收起 */
function listenItem(source: InboxSource, now: Date): InboxItem {
  const askedAt = new Date(source.created_at);
  const unread = source.read_at === null;
  const logHref = safeListenUrl(source.url);
  const actionable = unread && logHref !== null;
  return {
    id: source.id,
    journalId: null,
    line: source.title,
    meta: actionable ? `${source.body}・${askedLabel(askedAt, now)}` : askedStamp(askedAt),
    unread,
    actionable,
    result: "pending",
    cover: "plate",
    posterUrl: null,
    sayHref: null,
    logHref,
  };
}

function toItem(source: InboxSource, now: Date): InboxItem {
  if (source.kind === "listen_prompt") return listenItem(source, now);
  const askedAt = new Date(source.created_at);
  const entry = source.entry;
  const unread = source.read_at === null;
  const result = resultOf(entry?.status);
  const actionable = Boolean(entry) && unread && result === "pending";
  if (!entry) {
    return {
      id: source.id,
      journalId: null,
      line: source.title,
      meta: askedStamp(askedAt),
      unread,
      actionable: false,
      result,
      cover: "plate",
      posterUrl: null,
      sayHref: null,
      logHref: null,
    };
  }

  const experiencedAt = new Date(entry.experiencedAt);
  const kind = entry.work?.kind ?? null;
  const isScreenWork = kind === "movie" || kind === "series" || (!kind && entry.venue !== "live" && entry.venue !== "exhibition");
  // 排行程當天提醒：標題是早上提的「今天的場」，沒有說說看；場次過後紀錄轉成已看，之後的「想說說嗎」另一則
  if (source.kind === "plan_reminder") {
    return {
      id: source.id,
      journalId: entry.id,
      line: unread ? `${source.title}，${source.body}` : source.title,
      meta: `${logicalDateLabel(experiencedAt)} ${dayPeriod(experiencedAt)}・${SHORT_VENUE[entry.venue]}・${askedLabel(askedAt, now)}`,
      unread,
      actionable: false,
      result: entry.status === "planned" ? "planned" : resultOf(entry.status),
      cover: isScreenWork ? "poster" : "plate",
      posterUrl: entry.work?.poster_url ?? null,
      sayHref: null,
      logHref: null,
    };
  }
  if (source.kind === "settle_prompt") return settleItem(source, entry, now);
  const copy = buildReminderCopy({ workTitle: workName(entry), kind, experiencedAt, venue: entry.venue, askedAt });
  const title = `${copy.title}${episodeSuffix(entry.work)}`;
  const question = reminderQuestion({ kind, experiencedAt, venue: entry.venue, askedAt });
  const isScreen = kind === "movie" || kind === "series" || (!kind && entry.venue !== "live" && entry.venue !== "exhibition");
  return {
    id: source.id,
    journalId: entry.id,
    line: actionable ? `${title}，${question}` : title,
    meta: actionable
      ? `${logicalDateLabel(experiencedAt)} ${dayPeriod(experiencedAt)}・${SHORT_VENUE[entry.venue]}・${askedLabel(askedAt, now)}`
      : askedStamp(askedAt),
    unread,
    actionable,
    result,
    cover: isScreen ? "poster" : "plate",
    posterUrl: entry.work?.poster_url ?? null,
    sayHref: sayUrlFor(entry.id),
    logHref: null,
  };
}

/** 處理過的散場提醒收起結尾的呼籲（現行「說一段，或打幾句。」與 Q-56 前的「按住，說一段。」），只留標題與作品 */
const SETTLE_CALL_TO_ACTION = /(?:說一段，或打幾句。|按住，說一段。)$/;

function settleItem(source: InboxSource, entry: InboxEntrySource, now: Date): InboxItem {
  const askedAt = new Date(source.created_at);
  const experiencedAt = new Date(entry.experiencedAt);
  const unread = source.read_at === null;
  const result = resultOf(entry.status);
  const actionable = unread && result === "pending";
  const kind = entry.work?.kind ?? null;
  const isScreen = kind === "movie" || kind === "series" || (!kind && entry.venue !== "live" && entry.venue !== "exhibition");
  return {
    id: source.id,
    journalId: entry.id,
    line: actionable ? `${source.title}${source.body}` : `${source.title}${source.body.replace(SETTLE_CALL_TO_ACTION, "")}`,
    meta: actionable
      ? `${logicalDateLabel(experiencedAt)} ${dayPeriod(experiencedAt)}・${SHORT_VENUE[entry.venue]}・${askedLabel(askedAt, now)}`
      : askedStamp(askedAt),
    unread,
    actionable,
    result,
    cover: isScreen ? "poster" : "plate",
    posterUrl: entry.work?.poster_url ?? null,
    sayHref: sayUrlFor(entry.id),
    logHref: null,
  };
}

function sectionOf(createdAt: string, now: Date): InboxSectionKey {
  const days = logicalDaysBetween(new Date(createdAt), now);
  if (days === 0) return "today";
  return days < 7 ? "week" : "older";
}

export function buildInbox(sources: readonly InboxSource[], now: Date = new Date()): InboxView {
  const sorted = [...sources].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const keys: InboxSectionKey[] = ["today", "week", "older"];
  const sections = keys
    .map((key) => ({
      key,
      label: SECTION_LABELS[key],
      items: sorted.filter((source) => sectionOf(source.created_at, now) === key).map((s) => toItem(s, now)),
    }))
    .filter((section) => section.items.length > 0);
  return { sections, unreadCount: sources.filter((source) => source.read_at === null).length };
}
