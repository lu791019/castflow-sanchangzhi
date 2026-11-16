/**
 * 記一筆・場外變體的 API 邊界驗證（純函式）：
 * 場域是「音樂祭/演出」或「展覽」且帶了 liveName 時，作品由 server 依名稱＋日期建立或重用。
 * body：{ venue, liveName, liveVenue?, liveDates? }（其餘欄位照 parseCreateJournalInput）
 */

import { logicalDayParts, pad2 } from "@/lib/journal/time";
import { parseLiveDates, type LiveDateRange } from "./dates";
import type { LiveKind } from "./match";
import { liveKey } from "./name";

export const MAX_LIVE_NAME_LENGTH = 100;
export const MAX_LIVE_VENUE_LENGTH = 100;
export const LIVE_NAME_REQUIRED = "寫下演出名或展覽名";

export interface LiveJournalInput {
  kind: LiveKind;
  name: string;
  key: string;
  venue: string | null;
  dates: LiveDateRange;
}

export type LiveInputResult = { ok: true; value: LiveJournalInput | null } | { ok: false; error: string };

function isLiveKind(value: unknown): value is LiveKind {
  return value === "live" || value === "exhibition";
}

/** 邏輯日（4 點換日）YYYY-MM-DD */
export function logicalDateKey(date: Date): string {
  const { year, month, day } = logicalDayParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function text(value: unknown, field: string, max: number): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: `${field} 必須是文字` };
  const trimmed = value.trim();
  if (Array.from(trimmed).length > max) return { ok: false, error: `${field} 不可超過 ${max} 字` };
  return { ok: true, value: trimmed };
}

export function parseLiveJournalInput(body: unknown, experiencedAt: Date): LiveInputResult {
  if (!body || typeof body !== "object") return { ok: true, value: null };
  const raw = body as Record<string, unknown>;
  if (!isLiveKind(raw.venue) || raw.liveName === undefined) return { ok: true, value: null };

  const name = text(raw.liveName, "liveName", MAX_LIVE_NAME_LENGTH);
  if (!name.ok) return name;
  const key = liveKey(name.value);
  if (!key) return { ok: false, error: LIVE_NAME_REQUIRED };

  const venue = text(raw.liveVenue, "liveVenue", MAX_LIVE_VENUE_LENGTH);
  if (!venue.ok) return venue;

  if (raw.liveDates !== undefined && raw.liveDates !== null && typeof raw.liveDates !== "string") {
    return { ok: false, error: "liveDates 必須是文字" };
  }
  const day = logicalDateKey(experiencedAt);
  const dates = parseLiveDates((raw.liveDates as string | null | undefined) ?? "", day);
  if (!dates.ok) return dates;

  return {
    ok: true,
    value: {
      kind: raw.venue,
      name: name.value,
      key,
      venue: venue.value || null,
      dates: dates.value ?? { start: day, end: null },
    },
  };
}

/** 作品選擇器「手動輸入」的演出／展覽 → 與記一筆場外變體同一套歸併；其他類型回 null */
export function liveInputFromManual(
  input: { kind: string; title: string; venue?: string | null; eventDate?: string | null },
  now: Date,
): LiveJournalInput | null {
  if (!isLiveKind(input.kind)) return null;
  const key = liveKey(input.title);
  if (!key) return null;
  return {
    kind: input.kind,
    name: input.title,
    key,
    venue: input.venue ?? null,
    dates: { start: input.eventDate ?? logicalDateKey(now), end: null },
  };
}
