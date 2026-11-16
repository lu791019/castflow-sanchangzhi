/**
 * 場館類型（Q-36 兩層，migration 027 works.venue_type）：先依演出／展覽分層，再選類型。
 * 決定售票搜尋連結的排序與前兩顆（見 lib/links/search-links.ts）。DB check 約束與此同步。
 */

import type { LiveKind } from "./match";

export const LIVE_VENUE_TYPES = ["concert_hall", "theater", "livehouse", "festival", "arena"] as const;
export const EXHIBITION_VENUE_TYPES = ["museum", "history_museum", "gallery", "special"] as const;

export type LiveVenueType = (typeof LIVE_VENUE_TYPES)[number];
export type ExhibitionVenueType = (typeof EXHIBITION_VENUE_TYPES)[number];
export type VenueType = LiveVenueType | ExhibitionVenueType;

const LABELS: Record<VenueType, string> = {
  concert_hall: "音樂廳",
  theater: "劇場",
  livehouse: "Live House",
  festival: "音樂祭",
  arena: "體育館",
  museum: "美術館",
  history_museum: "博物館",
  gallery: "藝廊",
  special: "特展",
};

export interface VenueTypeOption {
  value: VenueType;
  label: string;
}

export const VENUE_TYPE_OPTIONS: Record<LiveKind, readonly VenueTypeOption[]> = {
  live: LIVE_VENUE_TYPES.map((value) => ({ value, label: LABELS[value] })),
  exhibition: EXHIBITION_VENUE_TYPES.map((value) => ({ value, label: LABELS[value] })),
};

export function venueTypeLabel(value: VenueType | null | undefined): string | null {
  return value ? LABELS[value] : null;
}

export function isVenueTypeFor(kind: LiveKind, value: unknown): value is VenueType {
  return VENUE_TYPE_OPTIONS[kind].some((option) => option.value === value);
}

/** 只認得 DB 存的值（其他類型或亂值 → null） */
export function asVenueType(value: unknown): VenueType | null {
  return isVenueTypeFor("live", value) || isVenueTypeFor("exhibition", value) ? value : null;
}

export function parseVenueType(
  kind: LiveKind,
  value: unknown,
): { ok: true; value: VenueType | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (!isVenueTypeFor(kind, value)) return { ok: false, error: "場館類型不在選項裡" };
  return { ok: true, value };
}
