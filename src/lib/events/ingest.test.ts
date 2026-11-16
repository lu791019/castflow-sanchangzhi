import { describe, expect, it } from "vitest";
import type { CollectedEvent } from "./collected";
import { INGEST_MAX_EVENTS, parseIngestBody, runIngest, ticketUnionUpdates, toEventRow, type IngestStore, type StoredTickets } from "./ingest";

function event(overrides: Partial<CollectedEvent> = {}): CollectedEvent {
  return {
    source: "kktix",
    sourceId: "Event-1",
    title: "島嶼夜歌",
    category: "concert",
    venue: "國家音樂廳",
    city: "臺北市",
    startsOn: "2026-10-20",
    endsOn: "2026-10-20",
    showTimes: [{ date: "2026-10-20", time: "19:30" }],
    ticketUrls: [{ source: "kktix", url: "https://a.kktix.cc/events/1" }],
    imageUrl: null,
    sourceUrl: "https://a.kktix.cc/events/1",
    ...overrides,
  };
}

describe("parseIngestBody", () => {
  it("來源與活動陣列；壞掉的筆數另計", () => {
    const parsed = parseIngestBody({ source: "kktix", events: [event(), { title: "x" }, event({ source: "opentix" })] });
    expect(parsed).toEqual({ ok: true, source: "kktix", events: [event()], invalid: 2 });
  });

  it("同一批同編號只留最後一筆（upsert 同一列不能改兩次）", () => {
    const parsed = parseIngestBody({ source: "kktix", events: [event({ title: "舊" }), event({ title: "新" })] });
    expect(parsed.ok && parsed.events.map((item) => item.title)).toEqual(["新"]);
  });

  it("不認得的來源、不是陣列、太多筆 → 錯誤", () => {
    expect(parseIngestBody(null)).toMatchObject({ ok: false });
    expect(parseIngestBody({ source: "tixcraft", events: [] })).toMatchObject({ ok: false });
    expect(parseIngestBody({ source: "kktix", events: "x" })).toMatchObject({ ok: false });
    expect(parseIngestBody({ source: "kktix", events: Array.from({ length: INGEST_MAX_EVENTS + 1 }, () => event()) })).toMatchObject({ ok: false });
  });
});

describe("toEventRow", () => {
  it("欄位轉成資料表格式並算 norm_key", () => {
    expect(toEventRow(event(), "2026-10-15T00:00:00.000Z")).toEqual({
      source: "kktix",
      source_id: "Event-1",
      title: "島嶼夜歌",
      category: "concert",
      venue: "國家音樂廳",
      city: "臺北市",
      starts_on: "2026-10-20",
      ends_on: "2026-10-20",
      show_times: [{ date: "2026-10-20", time: "19:30" }],
      ticket_urls: [{ source: "kktix", url: "https://a.kktix.cc/events/1" }],
      image_url: null,
      source_url: "https://a.kktix.cc/events/1",
      norm_key: "島嶼夜歌|2026-10-20|國家音樂廳",
      fetched_at: "2026-10-15T00:00:00.000Z",
      updated_at: "2026-10-15T00:00:00.000Z",
    });
  });
});

describe("ticketUnionUpdates：同 norm_key 的每一列都拿到全部售票連結", () => {
  it("只更新有缺的列", () => {
    const rows: StoredTickets[] = [
      { id: "a", norm_key: "k", ticket_urls: [{ source: "kktix", url: "https://a" }] },
      { id: "b", norm_key: "k", ticket_urls: [{ source: "opentix", url: "https://b" }] },
      { id: "c", norm_key: "other", ticket_urls: [] },
      { id: "d", norm_key: "k", ticket_urls: [{ source: "kktix", url: "https://a" }, { source: "opentix", url: "https://b" }] },
    ];
    expect(ticketUnionUpdates(rows)).toEqual([
      { id: "a", ticket_urls: [{ source: "kktix", url: "https://a" }, { source: "opentix", url: "https://b" }] },
      { id: "b", ticket_urls: [{ source: "kktix", url: "https://a" }, { source: "opentix", url: "https://b" }] },
    ]);
  });
});

describe("runIngest", () => {
  function store(existing: StoredTickets[] = []): IngestStore & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      upsert: async (rows) => {
        calls.push(`upsert:${rows.length}`);
      },
      ticketsByNormKeys: async (keys) => {
        calls.push(`read:${keys.length}`);
        return existing.filter((row) => keys.includes(row.norm_key));
      },
      updateTickets: async (updates) => {
        calls.push(`update:${updates.length}`);
      },
      pruneEnded: async (source, before) => {
        calls.push(`prune:${source}:${before}`);
        return 2;
      },
    };
  }

  it("寫入 → 聯集售票 → 清掉結束 30 天以上的", async () => {
    const db = store([
      { id: "a", norm_key: "島嶼夜歌|2026-10-20|國家音樂廳", ticket_urls: [{ source: "kktix", url: "https://a" }] },
      { id: "b", norm_key: "島嶼夜歌|2026-10-20|國家音樂廳", ticket_urls: [{ source: "opentix", url: "https://b" }] },
    ]);
    const result = await runIngest(db, "kktix", [event()], { invalid: 1, now: new Date("2026-10-15T04:00:00Z") });
    expect(result).toEqual({ received: 2, upserted: 1, invalid: 1, merged: 2, pruned: 2 });
    expect(db.calls).toEqual(["upsert:1", "read:1", "update:2", "prune:kktix:2026-09-15"]);
  });

  it("沒有活動也照樣清舊資料", async () => {
    const db = store();
    expect(await runIngest(db, "tfam", [], { invalid: 0, now: new Date("2026-10-15T04:00:00Z") })).toEqual({
      received: 0,
      upserted: 0,
      invalid: 0,
      merged: 0,
      pruned: 2,
    });
    expect(db.calls).toEqual(["prune:tfam:2026-09-15"]);
  });
});
