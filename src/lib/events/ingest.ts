/**
 * POST /api/events/ingest 的邏輯：worker 一次送一個來源的活動 → 驗證 → upsert(source, source_id)
 * → 同 norm_key（多來源同一活動）的每一列都補上全部售票連結 → 清掉這個來源結束 30 天以上的。
 * 資料庫操作走 IngestStore（repository.ts 實作），這裡可單元測試。
 */

import { taipeiDateKey } from "@/lib/journal/time";
import {
  EVENT_SOURCES,
  eventNormKey,
  unionTicketUrls,
  validateCollectedEvent,
  type CollectedEvent,
  type EventSource,
  type ShowTime,
  type TicketUrl,
} from "./collected";

/** 一次最多收這麼多筆（KKTIX 演出約 600 筆） */
export const INGEST_MAX_EVENTS = 2000;
/** 結束超過幾天的刪掉 */
export const PRUNE_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

export interface EventRow {
  source: EventSource;
  source_id: string;
  title: string;
  category: CollectedEvent["category"];
  venue: string | null;
  city: string | null;
  starts_on: string;
  ends_on: string;
  show_times: ShowTime[];
  ticket_urls: TicketUrl[];
  image_url: string | null;
  source_url: string;
  norm_key: string;
  fetched_at: string;
  updated_at: string;
}

export interface StoredTickets {
  id: string;
  norm_key: string;
  ticket_urls: TicketUrl[];
}

export interface IngestStore {
  upsert(rows: EventRow[]): Promise<void>;
  ticketsByNormKeys(keys: string[]): Promise<StoredTickets[]>;
  updateTickets(updates: Array<{ id: string; ticket_urls: TicketUrl[] }>): Promise<void>;
  /** 刪掉這個來源 ends_on 早於 before 的，回刪了幾筆 */
  pruneEnded(source: EventSource, before: string): Promise<number>;
}

export interface IngestResult {
  received: number;
  upserted: number;
  invalid: number;
  merged: number;
  pruned: number;
}

export type ParsedIngest = { ok: true; source: EventSource; events: CollectedEvent[]; invalid: number } | { ok: false; error: string };

export function parseIngestBody(body: unknown): ParsedIngest {
  if (!body || typeof body !== "object") return { ok: false, error: "缺少內容" };
  const raw = body as Record<string, unknown>;
  const source = raw.source;
  if (typeof source !== "string" || !(EVENT_SOURCES as readonly string[]).includes(source)) return { ok: false, error: "不認得的來源" };
  if (!Array.isArray(raw.events)) return { ok: false, error: "events 必須是陣列" };
  if (raw.events.length > INGEST_MAX_EVENTS) return { ok: false, error: `一次最多 ${INGEST_MAX_EVENTS} 筆` };
  const valid = raw.events.flatMap((item) => {
    const event = validateCollectedEvent(item);
    return event && event.source === source ? [event] : [];
  });
  // 同一批同編號：後面的蓋前面的
  const unique = [...new Map(valid.map((event) => [event.sourceId, event])).values()];
  return { ok: true, source: source as EventSource, events: unique, invalid: raw.events.length - valid.length };
}

export function toEventRow(event: CollectedEvent, nowIso: string): EventRow {
  return {
    source: event.source,
    source_id: event.sourceId,
    title: event.title,
    category: event.category,
    venue: event.venue,
    city: event.city,
    starts_on: event.startsOn,
    ends_on: event.endsOn,
    show_times: event.showTimes,
    ticket_urls: event.ticketUrls,
    image_url: event.imageUrl,
    source_url: event.sourceUrl,
    norm_key: eventNormKey(event),
    fetched_at: nowIso,
    updated_at: nowIso,
  };
}

const sameTickets = (a: readonly TicketUrl[], b: readonly TicketUrl[]) =>
  a.length === b.length && a.every((ticket, index) => ticket.url === b[index].url && ticket.source === b[index].source);

/** 同 norm_key 的列算聯集；只回傳內容有變的列 */
export function ticketUnionUpdates(rows: readonly StoredTickets[]): Array<{ id: string; ticket_urls: TicketUrl[] }> {
  const groups = rows.reduce((map, row) => map.set(row.norm_key, [...(map.get(row.norm_key) ?? []), row]), new Map<string, StoredTickets[]>());
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => {
      const union = unionTicketUrls(group.map((row) => row.ticket_urls));
      return group.filter((row) => !sameTickets(row.ticket_urls, union)).map((row) => ({ id: row.id, ticket_urls: union }));
    });
}

export async function runIngest(
  store: IngestStore,
  source: EventSource,
  events: readonly CollectedEvent[],
  options: { invalid: number; now: Date },
): Promise<IngestResult> {
  const nowIso = options.now.toISOString();
  let merged = 0;
  if (events.length > 0) {
    const rows = events.map((event) => toEventRow(event, nowIso));
    await store.upsert(rows);
    const keys = [...new Set(rows.map((row) => row.norm_key))];
    const updates = ticketUnionUpdates(await store.ticketsByNormKeys(keys));
    if (updates.length > 0) await store.updateTickets(updates);
    merged = updates.length;
  }
  const before = taipeiDateKey(new Date(options.now.getTime() - PRUNE_AFTER_DAYS * DAY_MS));
  const pruned = await store.pruneEnded(source, before);
  return { received: events.length + options.invalid, upserted: events.length, invalid: options.invalid, merged, pruned };
}
