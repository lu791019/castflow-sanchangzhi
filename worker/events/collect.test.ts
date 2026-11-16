import { describe, expect, it, vi } from "vitest";
import { EVENT_SOURCES, type CollectedEvent, type EventSource } from "../../src/lib/events/collected.ts";
import type { Alert, Notify } from "../notify.ts";
import { collectEvents, shouldCollect, type CollectDeps } from "./collect.ts";
import type { SourceCollector } from "./sources.ts";
import { emptyState, parseState } from "./state.ts";

const NOW = Date.parse("2026-10-15T02:00:00Z"); // 台北 10:00

function event(source: EventSource, sourceId: string): CollectedEvent {
  return {
    source,
    sourceId,
    title: "島嶼夜歌",
    category: "concert",
    venue: null,
    city: null,
    startsOn: "2026-10-20",
    endsOn: "2026-10-20",
    showTimes: [],
    ticketUrls: [],
    imageUrl: null,
    sourceUrl: "https://example.com/1",
  };
}

function deps(collectors: Partial<Record<EventSource, SourceCollector>>) {
  const ok: SourceCollector = async () => ({ events: [event("tfam", "1")], pageFailures: [] });
  return {
    fetcher: { getText: vi.fn(), postJson: vi.fn(), counts: () => ({}) },
    collectors: { ...(Object.fromEntries(EVENT_SOURCES.map((source) => [source, ok])) as Record<EventSource, SourceCollector>), ...collectors },
    ingest: vi.fn(async (_source: EventSource, events: CollectedEvent[]) => ({ received: events.length, upserted: events.length, invalid: 0, merged: 0, pruned: 0 })),
    notify: vi.fn<Notify>(async (level, title, detail) => ({ level, title, detail }) as unknown as Alert),
    log: () => undefined,
    now: () => NOW,
  } satisfies CollectDeps;
}

describe("shouldCollect：距上次跑（台北日期）滿間隔天數才跑", () => {
  it("每天一次", () => {
    expect(shouldCollect(emptyState(), new Date(NOW), 1)).toBe(true);
    expect(shouldCollect({ lastRunDay: "2026-10-15", pages: {} }, new Date(NOW), 1)).toBe(false);
    expect(shouldCollect({ lastRunDay: "2026-10-14", pages: {} }, new Date(NOW), 1)).toBe(true);
  });

  it("每週一次：滿 7 天才跑；沒跑過就跑", () => {
    expect(shouldCollect(emptyState(), new Date(NOW), 7)).toBe(true);
    expect(shouldCollect({ lastRunDay: "2026-10-15", pages: {} }, new Date(NOW), 7)).toBe(false);
    expect(shouldCollect({ lastRunDay: "2026-10-09", pages: {} }, new Date(NOW), 7)).toBe(false);
    expect(shouldCollect({ lastRunDay: "2026-10-08", pages: {} }, new Date(NOW), 7)).toBe(true);
    expect(shouldCollect({ lastRunDay: "2026-09-30", pages: {} }, new Date(NOW), 7)).toBe(true);
  });

  it("今天已經試過（整輪失敗）：今天不再重試，明天再試", () => {
    const failedToday = { lastRunDay: "2026-10-01", lastAttemptDay: "2026-10-15", pages: {} };
    expect(shouldCollect(failedToday, new Date(NOW), 7)).toBe(false);
    expect(shouldCollect({ ...failedToday, lastAttemptDay: "2026-10-14" }, new Date(NOW), 7)).toBe(true);
  });

  it("舊狀態檔沒有 lastAttemptDay：照 lastRunDay 判斷", () => {
    const state = parseState(JSON.stringify({ lastRunDay: "2026-10-01", pages: {} }));
    expect(state.lastAttemptDay ?? null).toBeNull();
    expect(shouldCollect(state, new Date(NOW), 7)).toBe(true);
  });
});

describe("collectEvents", () => {
  it("每個來源各自送 ingest；記下今天跑過", async () => {
    const d = deps({});
    const { state, reports } = await collectEvents(emptyState(), d);
    expect(d.ingest).toHaveBeenCalledTimes(EVENT_SOURCES.length);
    expect(reports.every((report) => report.ok)).toBe(true);
    expect(state.lastRunDay).toBe("2026-10-15");
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("只跑指定的來源：其他來源不抓也不送", async () => {
    const kktix = vi.fn<SourceCollector>(async () => ({ events: [event("kktix", "1")], pageFailures: [] }));
    const d = { ...deps({ kktix }), sources: ["opentix", "tfam"] as const };
    const { reports } = await collectEvents(emptyState(), d);
    expect(kktix).not.toHaveBeenCalled();
    expect(reports.map((report) => report.source)).toEqual(["opentix", "tfam"]);
    expect(d.ingest.mock.calls.map(([source]) => source)).toEqual(["opentix", "tfam"]);
  });

  it("上限倍數交給各來源（沒給就 1）", async () => {
    const seen: number[] = [];
    const spy: SourceCollector = async (context) => (seen.push(context.capScale), { events: [], pageFailures: [] });
    await collectEvents(emptyState(), { ...deps({ tfam: spy }), sources: ["tfam"] });
    await collectEvents(emptyState(), { ...deps({ tfam: spy }), sources: ["tfam"], capScale: 7 });
    expect(seen).toEqual([1, 7]);
  });

  it("某來源整個掛掉：推警報、其他來源照常寫入", async () => {
    const d = deps({
      kktix: async () => {
        throw new Error("https://kktix.com/events.atom?category_id=4 回應 403");
      },
    });
    const { reports } = await collectEvents(emptyState(), d);
    expect(reports.find((report) => report.source === "kktix")).toMatchObject({ ok: false, error: expect.stringContaining("403") });
    expect(d.ingest).toHaveBeenCalledTimes(EVENT_SOURCES.length - 1);
    expect(d.notify).toHaveBeenCalledWith("warn", expect.stringContaining("kktix 失敗"), expect.stringContaining("403"));
  });

  it("ingest 失敗也是那個來源的失敗，要警報", async () => {
    const d = deps({});
    d.ingest.mockImplementation(async (source: EventSource) => {
      if (source === "opentix") throw new Error("/api/events/ingest 失敗：HTTP 500");
      return { received: 1, upserted: 1, invalid: 0, merged: 0, pruned: 0 };
    });
    const { reports } = await collectEvents(emptyState(), d);
    expect(reports.filter((report) => !report.ok).map((report) => report.source)).toEqual(["opentix"]);
    expect(d.notify).toHaveBeenCalledWith("warn", expect.stringContaining("opentix"), expect.stringContaining("500"));
  });

  it("0 筆、活動頁失敗過半：也警報（不靜默）", async () => {
    const d = deps({
      accupass: async () => ({ events: [], pageFailures: [] }),
      opentix: async () => ({ events: [event("opentix", "1")], pageFailures: ["a 回應 500", "b 回應 500"] }),
    });
    await collectEvents(emptyState(), d);
    expect(d.notify).toHaveBeenCalledWith("warn", expect.stringContaining("accupass 這輪 0 筆"), expect.any(String));
    expect(d.notify).toHaveBeenCalledWith("warn", expect.stringContaining("opentix 活動頁多數抓不到"), expect.stringContaining("500"));
  });

  it("來源記下的頁面寫進狀態，太舊的紀錄清掉", async () => {
    const d = deps({
      tfam: async (context) => {
        context.remember("https://new", { fetchedAt: context.now });
        return { events: [event("tfam", "1")], pageFailures: [] };
      },
    });
    const old = { lastRunDay: "2026-08-01", pages: { "https://old": { fetchedAt: NOW - 61 * 86_400_000 }, "https://keep": { fetchedAt: NOW - 86_400_000 } } };
    const { state } = await collectEvents(old, d);
    expect(Object.keys(state.pages).sort()).toEqual(["https://keep", "https://new"]);
  });

  it("整輪全部失敗：不記成跑過（lastRunDay 不動），只記今天試過", async () => {
    const d = { ...deps({}), sources: ["opentix", "tfam"] as const };
    d.ingest.mockRejectedValue(new Error("/api/events/ingest 失敗：HTTP 503"));
    const { state } = await collectEvents({ lastRunDay: "2026-10-01", pages: {} }, d);
    expect(state.lastRunDay).toBe("2026-10-01");
    expect(state.lastAttemptDay).toBe("2026-10-15");
  });

  it("至少一個來源成功：記成今天跑過", async () => {
    const d = { ...deps({}), sources: ["opentix", "tfam"] as const };
    d.ingest.mockImplementation(async (source: EventSource) => {
      if (source === "opentix") throw new Error("HTTP 503");
      return { received: 1, upserted: 1, invalid: 0, merged: 0, pruned: 0 };
    });
    const { state } = await collectEvents({ lastRunDay: "2026-10-01", pages: {} }, d);
    expect(state.lastRunDay).toBe("2026-10-15");
  });

  it("送進 app 失敗：那個來源這輪記下的頁面不寫進狀態，下一輪會重抓；其他來源照記", async () => {
    const d = {
      ...deps({
        opentix: async (context) => {
          context.remember("https://opentix/1", { fetchedAt: context.now });
          return { events: [event("opentix", "1")], pageFailures: [] };
        },
        tfam: async (context) => {
          context.remember("https://tfam/1", { fetchedAt: context.now });
          return { events: [event("tfam", "1")], pageFailures: [] };
        },
      }),
      sources: ["opentix", "tfam"] as const,
    };
    d.ingest.mockImplementation(async (source: EventSource) => {
      if (source === "opentix") throw new Error("HTTP 503");
      return { received: 1, upserted: 1, invalid: 0, merged: 0, pruned: 0 };
    });
    const { state } = await collectEvents(emptyState(), d);
    expect(Object.keys(state.pages)).toEqual(["https://tfam/1"]);
  });

  it("來源中途丟錯：已記下的頁面也不寫進狀態；之前的紀錄保留", async () => {
    const d = {
      ...deps({
        opentix: async (context) => {
          context.remember("https://opentix/new", { fetchedAt: context.now });
          throw new Error("列表 回應 500");
        },
      }),
      sources: ["opentix"] as const,
    };
    const { state } = await collectEvents({ lastRunDay: null, pages: { "https://opentix/old": { fetchedAt: NOW - 86_400_000 } } }, d);
    expect(Object.keys(state.pages)).toEqual(["https://opentix/old"]);
  });

  it("同一輪內，來源自己記下的頁面讀得到（避免同輪重抓）", async () => {
    const seen: (number | undefined)[] = [];
    const d = {
      ...deps({
        tfam: async (context) => {
          context.remember("https://tfam/1", { fetchedAt: 123 });
          seen.push(context.memo("https://tfam/1")?.fetchedAt);
          return { events: [event("tfam", "1")], pageFailures: [] };
        },
      }),
      sources: ["tfam"] as const,
    };
    await collectEvents(emptyState(), d);
    expect(seen).toEqual([123]);
  });
});
