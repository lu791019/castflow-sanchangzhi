/** 解析器共用：把各站欄位組成 CollectedEvent，順便套類別推斷與雜訊過濾（純函式） */

import {
  classifyTitle,
  httpsUrl,
  isNoiseTitle,
  MAX_TITLE_LENGTH,
  MAX_VENUE_LENGTH,
  type CollectedEvent,
  type EventCategory,
  type EventSource,
  type ShowTime,
} from "../../src/lib/events/collected.ts";
import { cleanText } from "./html.ts";

export interface EventDraft {
  source: EventSource;
  sourceId: string;
  title: string;
  /** 來源給的類別；標題看得出細類就以標題為準 */
  fallbackCategory: EventCategory;
  venue: string | null;
  city: string | null;
  startsOn: string;
  endsOn: string | null;
  showTimes: ShowTime[];
  ticketUrls: string[];
  imageUrl: string | null;
  sourceUrl: string;
}

function clip(value: string, max: number): string {
  return Array.from(value).slice(0, max).join("");
}

/** 影展、課程、測試活動等不收回 null；起訖顛倒以開始日為準 */
export function buildEvent(draft: EventDraft): CollectedEvent | null {
  const title = clip(cleanText(draft.title), MAX_TITLE_LENGTH);
  const sourceUrl = httpsUrl(draft.sourceUrl);
  if (!title || !sourceUrl || isNoiseTitle(title)) return null;
  const category = classifyTitle(title, draft.fallbackCategory);
  if (!category) return null;
  const venue = clip(cleanText(draft.venue), MAX_VENUE_LENGTH) || null;
  const endsOn = draft.endsOn && draft.endsOn >= draft.startsOn ? draft.endsOn : draft.startsOn;
  const tickets = draft.ticketUrls.flatMap((url) => {
    const safe = httpsUrl(url);
    return safe ? [{ source: draft.source, url: safe }] : [];
  });
  return {
    source: draft.source,
    sourceId: draft.sourceId,
    title,
    category,
    venue,
    city: draft.city,
    startsOn: draft.startsOn,
    endsOn,
    showTimes: draft.showTimes,
    ticketUrls: tickets,
    imageUrl: httpsUrl(draft.imageUrl),
    sourceUrl,
  };
}
