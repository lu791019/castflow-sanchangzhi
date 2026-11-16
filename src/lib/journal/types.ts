/** 視聽日誌的領域型別與列舉（DB check 約束與此同步，見 migration 010） */

export const VENUES = ["home", "cinema", "live", "exhibition", "commute", "other"] as const;
export type Venue = (typeof VENUES)[number];

export const VENUE_LABELS: Record<Venue, string> = {
  home: "在家",
  cinema: "電影院",
  live: "音樂祭/演出",
  exhibition: "展覽",
  commute: "通勤路上",
  other: "其他",
};

/** planned＝排行程（experienced_at 在未來，migration 026）；場次過後由 app 轉 recorded */
export const JOURNAL_STATUSES = ["planned", "recorded", "said", "skipped"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export const REMINDER_TIMINGS = ["next_noon", "half_day", "off"] as const;
export type ReminderTiming = (typeof REMINDER_TIMINGS)[number];
export const DEFAULT_REMINDER_TIMING: ReminderTiming = "next_noon";

export interface JournalEntry {
  id: string;
  work_id: string | null;
  work_title_fallback: string | null;
  experienced_at: string;
  venue: Venue;
  companions: string | null;
  /** 0.5～5 星（0.5 為一階）；只有本人看得到（Q-83） */
  rating: number | null;
  status: JournalStatus;
  episode_id: string | null;
  remind_at: string | null;
  reminded_at: string | null;
  created_at: string;
}

export const JOURNAL_COLUMNS =
  "id, work_id, work_title_fallback, experienced_at, venue, companions, rating, status, episode_id, remind_at, reminded_at, created_at";

export function isVenue(value: unknown): value is Venue {
  return typeof value === "string" && (VENUES as readonly string[]).includes(value);
}

export function isReminderTiming(value: unknown): value is ReminderTiming {
  return typeof value === "string" && (REMINDER_TIMINGS as readonly string[]).includes(value);
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
