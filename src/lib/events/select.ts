/**
 * 散場之前：多來源藝文活動（events 表）＋文化部開放資料合併（純函式）。
 * 1. events 列先依 norm_key 收成一筆（售票連結多的優先 → 有圖 → 來源順位）
 * 2. 轉成文化部同一個形狀，走同一套 30 天窗／選場次／常態節目不收
 * 3. 和文化部合併：同類、名稱正規化相同、日期相近（場刊歸併規則）就是同一場，只留售票連結多的（一樣多留先到的文化部）
 * 4. 照日期排、各類取上限；每個出處先最多佔一半，不夠再照日期補（KKTIX 量大，不讓它把文化部、OPENTIX 擠掉）
 */

import { dayGap, MAX_DAY_GAP } from "@/lib/venue/match";
import { liveKey } from "@/lib/venue/name";
import { cityFromAddress, eventKindOf, type EventSource } from "./collected";
import { compareSelectedEvents, selectInWindow, type CultureEvent, type CultureKind, type CultureSession, type SelectedCultureEvent } from "./culture";
import type { StoredEvent } from "./repository";

export type EventOrigin = "culture" | EventSource;

/** 散場之前用的活動：多帶出處與售票連結數（文化部的 origin 可省略） */
export type SourcedEvent = SelectedCultureEvent & { origin?: EventOrigin; ticketCount?: number };
export type SourcedEvents = Record<CultureKind, SourcedEvent[]>;

/** 合併後各類上限（文化部單獨時是演出 12、展覽 8） */
export const MERGED_LIMITS: Record<CultureKind, number> = { live: 16, exhibition: 10 };

/** 已排好序的清單取 limit 筆：每個出處先最多 cap 筆，不夠再照順序補；回傳仍照原順序 */
export function fairTake(sorted: readonly SourcedEvent[], limit: number, cap: number): SourcedEvent[] {
  const counts = new Map<string, number>();
  const first = new Set<SourcedEvent>();
  for (const event of sorted) {
    const origin = event.origin ?? "culture";
    const used = counts.get(origin) ?? 0;
    if (first.size < limit && used < cap) {
      first.add(event);
      counts.set(origin, used + 1);
    }
  }
  const rest = sorted.filter((event) => !first.has(event)).slice(0, limit - first.size);
  const chosen = new Set([...first, ...rest]);
  return sorted.filter((event) => chosen.has(event));
}

/** 同 norm_key 售票連結數、有沒有圖都一樣時的先後：售票平台 → 北美館 → 館方展覽（照收錄順序） → Accupass */
const SOURCE_RANK: Record<EventSource, number> = {
  opentix: 0,
  kktix: 1,
  tfam: 2,
  nmns: 3,
  nmmba: 3,
  songshan: 3,
  nstm: 3,
  tnam: 3,
  ntm: 3,
  nmh: 3,
  cksmh: 3,
  clab: 3,
  moca: 3,
  kdmofa: 3,
  accupass: 4,
};

function better(a: StoredEvent, b: StoredEvent): StoredEvent {
  if (a.ticket_urls.length !== b.ticket_urls.length) return a.ticket_urls.length > b.ticket_urls.length ? a : b;
  if (!!a.image_url !== !!b.image_url) return a.image_url ? a : b;
  return SOURCE_RANK[a.source] <= SOURCE_RANK[b.source] ? a : b;
}

/** 同 norm_key 只留一筆（保留第一次出現的位置） */
export function collapseByNormKey(rows: readonly StoredEvent[]): StoredEvent[] {
  const best = rows.reduce((map, row) => {
    const current = map.get(row.norm_key);
    return map.set(row.norm_key, current ? better(current, row) : row);
  }, new Map<string, StoredEvent>());
  return [...best.values()];
}

function sessionsOf(row: StoredEvent): CultureSession[] {
  // ingest 已驗過白名單；這裡再正規化一次（台 → 臺）
  const city = cityFromAddress(row.city);
  if (row.show_times.length >= 2) {
    return row.show_times.map((show) => ({ start: show.date, end: null, time: show.time, venue: row.venue, city }));
  }
  return [
    { start: row.starts_on, end: row.ends_on > row.starts_on ? row.ends_on : null, time: row.show_times[0]?.time ?? null, venue: row.venue, city },
  ];
}

export function storedToCultureEvent(row: StoredEvent): CultureEvent & { origin: EventSource; ticketCount: number } {
  const ticket = row.ticket_urls[0]?.url;
  return {
    uid: `${row.source}:${row.source_id}`,
    origin: row.source,
    ticketCount: row.ticket_urls.length,
    kind: eventKindOf(row.category),
    festival: row.category === "festival",
    category: row.category,
    title: row.title,
    imageUrl: row.image_url,
    link: ticket ? { url: ticket, ticket: true } : { url: row.source_url, ticket: false },
    sessions: sessionsOf(row),
  };
}

/** 已選好場次的活動分成演出、展覽（保留順序） */
export function splitByKind<T extends SourcedEvent>(selected: readonly T[]): Record<CultureKind, T[]> {
  return {
    live: selected.filter((event) => event.kind === "live"),
    exhibition: selected.filter((event) => event.kind === "exhibition"),
  };
}

/** events 列 → 30 天窗內、各選一場、近的在前（不設上限） */
export function selectStoredEvents(rows: readonly StoredEvent[], today: string): SourcedEvents {
  return splitByKind(selectInWindow(collapseByNormKey(rows).map(storedToCultureEvent), today));
}

const ticketsOf = (event: SourcedEvent) => event.ticketCount ?? (event.link?.ticket ? 1 : 0);

function sameEvent(a: SourcedEvent, b: SourcedEvent): boolean {
  if (a.kind !== b.kind) return false;
  const key = liveKey(a.title);
  if (!key || key !== liveKey(b.title)) return false;
  const range = (event: SourcedEvent) => ({ start: event.session.start, end: event.session.end ?? event.session.start });
  return dayGap(range(a), range(b)) <= MAX_DAY_GAP[a.kind];
}

/** 後到的比較好：售票連結多；一樣多就看有沒有海報；都一樣留先到的 */
function outranks(event: SourcedEvent, kept: SourcedEvent): boolean {
  if (ticketsOf(event) !== ticketsOf(kept)) return ticketsOf(event) > ticketsOf(kept);
  return !!event.imageUrl && !kept.imageUrl;
}

/** 依序放入；遇到同一場就留比較好的那張（outranks） */
function dedupeAcross(events: readonly SourcedEvent[]): SourcedEvent[] {
  return events.reduce<SourcedEvent[]>((kept, event) => {
    const index = kept.findIndex((other) => sameEvent(other, event));
    if (index < 0) return [...kept, event];
    if (!outranks(event, kept[index])) return kept;
    return kept.map((other, position) => (position === index ? event : other));
  }, []);
}

/** 同一類的文化部（標 origin）＋多來源：同一場只留一張、近的在前（不設上限） */
export function mergeSorted(culture: readonly SourcedEvent[], events: readonly SourcedEvent[], today: string): SourcedEvent[] {
  const fromCulture = culture.map((event) => ({ ...event, origin: "culture" as const }));
  return dedupeAcross([...fromCulture, ...events]).sort(compareSelectedEvents(today));
}

export function mergeEventSources(culture: Readonly<SourcedEvents>, events: Readonly<SourcedEvents>, today: string): SourcedEvents {
  const merge = (kind: CultureKind) =>
    fairTake(mergeSorted(culture[kind], events[kind], today), MERGED_LIMITS[kind], Math.ceil(MERGED_LIMITS[kind] / 2));
  return { live: merge("live"), exhibition: merge("exhibition") };
}
