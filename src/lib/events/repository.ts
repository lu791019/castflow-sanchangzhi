/** events 表讀寫（server only，service role；活動是公開資料，不帶任何使用者資訊） */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventCategory, EventSource, ShowTime, TicketUrl } from "./collected";
import type { IngestStore, StoredTickets } from "./ingest";

const UPSERT_CHUNK = 200;
/** norm_key 是中文長字串，in(...) 放在網址裡：每批編碼後不超過這麼長（PostgREST 網址過長會 414） */
export const KEY_QUERY_MAX_CHARS = 4_000;
/** 散場之前一次最多讀這麼多筆（30 天窗；再多也排不上卡片） */
export const WINDOW_READ_LIMIT = 400;

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

/** 依網址編碼後的長度分批（單一個超長的也自成一批） */
export function chunkKeysByLength(keys: readonly string[], maxChars = KEY_QUERY_MAX_CHARS): string[][] {
  return keys.reduce<string[][]>((batches, key) => {
    const size = encodeURIComponent(`"${key}",`).length;
    const last = batches[batches.length - 1];
    const used = last ? last.reduce((sum, item) => sum + encodeURIComponent(`"${item}",`).length, 0) : Infinity;
    return last && used + size <= maxChars ? [...batches.slice(0, -1), [...last, key]] : [...batches, [key]];
  }, []);
}

export function createIngestStore(client: SupabaseClient = createAdminClient()): IngestStore {
  return {
    async upsert(rows) {
      for (const part of chunks(rows, UPSERT_CHUNK)) {
        const { error } = await client.from("events").upsert(part, { onConflict: "source,source_id" });
        if (error) throw new Error(`寫入活動失敗：${error.message}`);
      }
    },
    async ticketsByNormKeys(keys) {
      const found: StoredTickets[] = [];
      for (const part of chunkKeysByLength(keys)) {
        const { data, error } = await client.from("events").select("id, norm_key, ticket_urls").in("norm_key", part);
        if (error) throw new Error(`讀取售票連結失敗：${error.message}`);
        found.push(...((data ?? []) as StoredTickets[]));
      }
      return found;
    },
    async updateTickets(updates) {
      for (const update of updates) {
        const { error } = await client.from("events").update({ ticket_urls: update.ticket_urls }).eq("id", update.id);
        if (error) throw new Error(`合併售票連結失敗：${error.message}`);
      }
    },
    async pruneEnded(source, before) {
      const { data, error } = await client.from("events").delete().eq("source", source).lt("ends_on", before).select("id");
      if (error) throw new Error(`清除過期活動失敗：${error.message}`);
      return data?.length ?? 0;
    },
  };
}

export interface StoredEvent {
  id: string;
  source: EventSource;
  source_id: string;
  title: string;
  category: EventCategory;
  venue: string | null;
  city: string | null;
  starts_on: string;
  ends_on: string;
  show_times: ShowTime[];
  ticket_urls: TicketUrl[];
  image_url: string | null;
  source_url: string;
  norm_key: string;
}

const WINDOW_COLUMNS =
  "id, source, source_id, title, category, venue, city, starts_on, ends_on, show_times, ticket_urls, image_url, source_url, norm_key";

/** 檔期和 [from, to] 有交集的活動，開始早的在前 */
export async function listWindowEvents(from: string, to: string, client: SupabaseClient = createAdminClient()): Promise<StoredEvent[]> {
  const { data, error } = await client
    .from("events")
    .select(WINDOW_COLUMNS)
    .gte("ends_on", from)
    .lte("starts_on", to)
    .order("starts_on", { ascending: true })
    .limit(WINDOW_READ_LIMIT);
  if (error) throw new Error(`讀取藝文活動失敗：${error.message}`);
  return (data ?? []) as StoredEvent[];
}
