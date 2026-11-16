/**
 * 記一筆的「先填後登入」草稿（UX-03）：訪客按「記下了」收到 401 時，把 sheet 填過的存在這台瀏覽器，
 * 登入回來（/journal/new?resume=1）還原並提示「剛剛填的還在」；送出成功才清。
 * 讀回來的一律重新驗證（localStorage 是外部輸入），不合法或超過一天就當沒有。
 */

import { loginRedirectPath } from "@/lib/auth/paths";
import type { RecentLogWork } from "./recent-works";
import { isVenue, type Venue } from "./types";
import type { WhenChoice } from "./when";

export const LOG_DRAFT_VERSION = 1;
export const LOG_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const LOG_DRAFT_KEY = "castflow-log-draft";
export const LOG_RESUME_PARAM = "resume";

const WHEN_CHOICES: readonly WhenChoice[] = ["now", "earlier", "yesterday", "custom"];
const WORK_KINDS = ["movie", "series", "podcast_episode", "live", "exhibition", "music"] as const;
const LIVE_FIELDS = ["name", "venue", "dates", "venueType", "ticketUrl", "coverUrl"] as const;

export type LogDraftLive = Record<(typeof LIVE_FIELDS)[number], string>;

export interface LogDraft {
  version: typeof LOG_DRAFT_VERSION;
  savedAt: string;
  work: RecentLogWork | null;
  when: WhenChoice;
  custom: string;
  place: Venue | null;
  companions: string;
  live: LogDraftLive;
}

type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null;
const isNullableString = (value: unknown) => value === null || typeof value === "string";

function parseWork(value: unknown): RecentLogWork | null | undefined {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  const { id, kind, title, podcast_show, episode_number, poster_url } = value;
  const valid =
    typeof id === "string" &&
    typeof title === "string" &&
    (WORK_KINDS as readonly unknown[]).includes(kind) &&
    isNullableString(podcast_show) &&
    (episode_number === null || typeof episode_number === "number") &&
    isNullableString(poster_url);
  if (!valid) return undefined;
  return { id, kind, title, podcast_show, episode_number, poster_url } as RecentLogWork;
}

function parseLive(value: unknown): LogDraftLive | null {
  if (!isObject(value) || !LIVE_FIELDS.every((field) => typeof value[field] === "string")) return null;
  return Object.fromEntries(LIVE_FIELDS.map((field) => [field, value[field] as string])) as LogDraftLive;
}

export function parseLogDraft(raw: string | null | undefined, now: Date): LogDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || value.version !== LOG_DRAFT_VERSION || typeof value.savedAt !== "string") return null;
  const savedAt = Date.parse(value.savedAt);
  if (Number.isNaN(savedAt) || now.getTime() - savedAt > LOG_DRAFT_TTL_MS) return null;

  const work = parseWork(value.work);
  const live = parseLive(value.live);
  const place = value.place === null ? null : isVenue(value.place) ? value.place : undefined;
  const when = WHEN_CHOICES.find((choice) => choice === value.when);
  if (work === undefined || !live || place === undefined || !when) return null;
  if (typeof value.custom !== "string" || typeof value.companions !== "string") return null;
  // 什麼都沒填就不值得還原
  if (!work && !live.name.trim() && !place) return null;

  return {
    version: LOG_DRAFT_VERSION,
    savedAt: value.savedAt,
    work,
    when,
    custom: value.custom,
    place,
    companions: value.companions,
    live,
  };
}

export function logResumePath(): string {
  return loginRedirectPath("/journal/new", `?${LOG_RESUME_PARAM}=1`);
}
