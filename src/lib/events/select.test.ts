import { describe, expect, it } from "vitest";
import type { SelectedCultureEvent } from "./culture";
import type { StoredEvent } from "./repository";
import { collapseByNormKey, fairTake, mergeEventSources, MERGED_LIMITS, selectStoredEvents, storedToCultureEvent, type SourcedEvent } from "./select";

const TODAY = "2026-10-15";

function stored(overrides: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: "id-1",
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
    ...overrides,
  };
}

function culture(overrides: Partial<SelectedCultureEvent> = {}): SelectedCultureEvent {
  const session = { start: "2026-10-20", end: null, time: "19:30", venue: "國家音樂廳" };
  return { uid: "c1", kind: "live", festival: false, title: "島嶼夜歌", imageUrl: null, link: null, sessions: [session], session, ...overrides };
}

describe("storedToCultureEvent：events 列 → 散場之前共用的活動形狀", () => {
  it("單場：場次＝起訖、購票連第一個售票網址", () => {
    expect(storedToCultureEvent(stored())).toEqual({
      uid: "kktix:Event-1",
      origin: "kktix",
      ticketCount: 1,
      kind: "live",
      festival: false,
      category: "concert",
      title: "島嶼夜歌",
      imageUrl: null,
      link: { url: "https://a.kktix.cc/events/1", ticket: true },
      sessions: [{ start: "2026-10-20", end: null, time: "19:30", venue: "國家音樂廳", city: "臺北市" }],
    });
  });

  it("多場次：每場一個 session；沒售票網址連活動頁；音樂祭標記", () => {
    const event = storedToCultureEvent(
      stored({
        category: "festival",
        starts_on: "2026-10-16",
        ends_on: "2026-10-17",
        show_times: [
          { date: "2026-10-16", time: "19:30" },
          { date: "2026-10-17", time: "14:30" },
        ],
        ticket_urls: [],
      }),
    );
    expect(event.festival).toBe(true);
    expect(event.link).toEqual({ url: "https://a.kktix.cc/events/1", ticket: false });
    expect(event.sessions.map((session) => [session.start, session.time])).toEqual([
      ["2026-10-16", "19:30"],
      ["2026-10-17", "14:30"],
    ]);
  });

  it("展覽：一段展期", () => {
    expect(storedToCultureEvent(stored({ category: "exhibition", starts_on: "2026-09-12", ends_on: "2027-01-03", show_times: [] })).sessions).toEqual([
      { start: "2026-09-12", end: "2027-01-03", time: null, venue: "國家音樂廳", city: "臺北市" },
    ]);
  });

  it("縣市：沿用 events.city（台 → 臺）；沒有就 null", () => {
    expect(storedToCultureEvent(stored({ city: "台中市" })).sessions[0].city).toBe("臺中市");
    expect(storedToCultureEvent(stored({ city: null })).sessions[0].city).toBeNull();
  });
});

describe("collapseByNormKey：同一活動多來源只留一筆", () => {
  it("售票連結多的優先，再看有沒有圖", () => {
    const rows = [
      stored({ id: "a", source: "accupass", source_id: "1", ticket_urls: [{ source: "accupass", url: "https://x" }] }),
      stored({ id: "b", source: "kktix", ticket_urls: [{ source: "kktix", url: "https://a" }, { source: "accupass", url: "https://x" }] }),
      stored({ id: "c", source: "opentix", source_id: "9", norm_key: "其他|2026-10-20|", ticket_urls: [] }),
    ];
    expect(collapseByNormKey(rows).map((row) => row.id)).toEqual(["b", "c"]);
    const tie = [stored({ id: "a" }), stored({ id: "b", source: "opentix", image_url: "https://img" })];
    expect(collapseByNormKey(tie).map((row) => row.id)).toEqual(["b"]);
  });
});

describe("selectStoredEvents：30 天內有場次；展覽跨期照收；常態節目不收", () => {
  it("", () => {
    const rows = [
      stored({ id: "in" }),
      stored({ id: "far", source_id: "2", norm_key: "far", starts_on: "2026-11-30", ends_on: "2026-11-30", show_times: [{ date: "2026-11-30", time: null }] }),
      stored({ id: "long", source_id: "3", norm_key: "long", starts_on: "2026-10-01", ends_on: "2026-12-31", show_times: [{ date: "2026-10-01", time: "20:00" }] }),
      stored({ id: "expo", source_id: "4", norm_key: "expo", category: "exhibition", starts_on: "2025-12-26", ends_on: "2027-12-19", show_times: [] }),
    ];
    const selected = selectStoredEvents(rows, TODAY);
    expect(selected.live.map((event) => event.uid)).toEqual(["kktix:Event-1"]);
    expect(selected.exhibition.map((event) => event.uid)).toEqual(["kktix:4"]);
  });

  it("多場次挑今天以後第一場", () => {
    const selected = selectStoredEvents(
      [
        stored({
          starts_on: "2026-10-10",
          ends_on: "2026-10-25",
          show_times: [
            { date: "2026-10-10", time: "19:30" },
            { date: "2026-10-18", time: "14:30" },
            { date: "2026-10-25", time: "19:30" },
          ],
        }),
      ],
      TODAY,
    );
    expect(selected.live[0].session).toEqual({ start: "2026-10-18", end: null, time: "14:30", venue: "國家音樂廳", city: "臺北市" });
  });
});

describe("mergeEventSources：文化部＋多來源合併去重", () => {
  it("同類同名、日期相近只留一張，售票連結多的優先", () => {
    const fromCulture = { live: [culture({ link: { url: "https://culture", ticket: true } })], exhibition: [] };
    const fromEvents = selectStoredEvents(
      [stored({ ticket_urls: [{ source: "kktix", url: "https://a" }, { source: "opentix", url: "https://b" }] })],
      TODAY,
    );
    const merged = mergeEventSources(fromCulture, fromEvents, TODAY);
    expect(merged.live.map((event) => event.uid)).toEqual(["kktix:Event-1"]);
  });

  it("一樣多、都沒海報就留文化部那張（先到先留）", () => {
    const fromCulture = { live: [culture({ link: { url: "https://culture", ticket: true } })], exhibition: [] };
    const merged = mergeEventSources(fromCulture, selectStoredEvents([stored()], TODAY), TODAY);
    expect(merged.live.map((event) => event.uid)).toEqual(["c1"]);
    expect(merged.live[0].origin).toBe("culture");
  });

  it("一樣多時有海報的優先（文化部沒圖、館方有圖 → 留館方）", () => {
    const fromCulture = { live: [culture({ imageUrl: null, link: { url: "https://culture", ticket: true } })], exhibition: [] };
    const merged = mergeEventSources(fromCulture, selectStoredEvents([stored({ image_url: "https://img/poster.jpg" })], TODAY), TODAY);
    expect(merged.live.map((event) => event.uid)).toEqual(["kktix:Event-1"]);
  });

  it("不同活動都留、照日期排、各類上限", () => {
    const fromCulture = { live: [culture({ uid: "c2", title: "別的演出", session: { start: "2026-10-22", end: null, time: null, venue: null } })], exhibition: [] };
    const many = Array.from({ length: MERGED_LIMITS.live + 5 }, (_, index) =>
      stored({ id: `e${index}`, source_id: `${index}`, title: `演出 ${index}`, norm_key: `n${index}` }),
    );
    const merged = mergeEventSources(fromCulture, selectStoredEvents(many, TODAY), TODAY);
    expect(merged.live).toHaveLength(MERGED_LIMITS.live);
    expect(merged.live.every((event, index, list) => index === 0 || list[index - 1].session.start <= event.session.start)).toBe(true);
  });
});

describe("fairTake：每個出處先最多佔一半", () => {
  const item = (origin: SourcedEvent["origin"], day: number): SourcedEvent => {
    const session = { start: `2026-10-${String(day).padStart(2, "0")}`, end: null, time: null, venue: null };
    return { uid: `${origin}${day}`, origin, kind: "live", festival: false, title: `${origin}${day}`, imageUrl: null, link: null, sessions: [session], session };
  };

  it("KKTIX 很多、文化部在後面：文化部還是排得進來，照日期排", () => {
    const sorted = [...Array.from({ length: 10 }, (_, index) => item("kktix", 15 + index)), item("culture", 28), item("culture", 29)];
    const taken = fairTake(sorted, 6, 3);
    expect(taken.map((event) => event.uid)).toEqual(["kktix15", "kktix16", "kktix17", "kktix18", "culture28", "culture29"]);
  });

  it("只有一個出處就照日期補滿", () => {
    const sorted = Array.from({ length: 10 }, (_, index) => item("opentix", 15 + index));
    expect(fairTake(sorted, 6, 3)).toHaveLength(6);
  });
});
