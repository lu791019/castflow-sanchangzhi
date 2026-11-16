import { describe, expect, it } from "vitest";
import { CULTURE_LIMITS, type CultureEvent, type CultureSession } from "./culture";
import { buildEventPool } from "./pool";
import type { StoredEvent } from "./repository";
import { MERGED_LIMITS } from "./select";

const TODAY = "2026-10-15";

function day(offset: number): string {
  return new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

function session(start: string, city: string | null): CultureSession {
  return { start, end: null, time: "19:30", venue: "某場地", city };
}

function culture(uid: string, overrides: Partial<CultureEvent> = {}): CultureEvent {
  return {
    uid,
    kind: "live",
    festival: false,
    title: `文化部 ${uid}`,
    imageUrl: null,
    link: null,
    category: "performance",
    sessions: [session(day(3), "臺北市")],
    ...overrides,
  };
}

function stored(id: string, overrides: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id,
    source: "kktix",
    source_id: id,
    title: `多來源 ${id}`,
    category: "concert",
    venue: "某場地",
    city: "臺北市",
    starts_on: day(5),
    ends_on: day(5),
    show_times: [{ date: day(5), time: "20:00" }],
    ticket_urls: [{ source: "kktix", url: `https://a.kktix.cc/events/${id}` }],
    image_url: null,
    source_url: `https://a.kktix.cc/events/${id}`,
    norm_key: `多來源${id}|${day(5)}|某場地`,
    ...overrides,
  };
}

const uids = (events: ReadonlyArray<{ uid: string }>) => events.map((event) => event.uid);

describe("buildEventPool：沒選縣市（預設）＝和原本一樣", () => {
  it("文化部先取舊上限、再合併取演出 16／展覽 10；沒有縣市資料的也在", () => {
    const many = Array.from({ length: 20 }, (_, index) => culture(`c${index}`, { sessions: [session(day(index % 25), null)] }));
    const pool = buildEventPool({ culture: many, stored: [], today: TODAY, city: null });
    expect(pool.main.live).toHaveLength(CULTURE_LIMITS.live);
    expect(pool.main.exhibition).toHaveLength(0);
  });

  it("多來源依 norm_key 收成一筆，出處標好", () => {
    const pool = buildEventPool({ culture: [], stored: [stored("a"), stored("a2", { source: "opentix", norm_key: `多來源a|${day(5)}|某場地` })], today: TODAY, city: null });
    expect(pool.main.live).toHaveLength(1);
  });
});

describe("buildEventPool：選了縣市", () => {
  const taipei = culture("tp", { sessions: [session(day(2), "臺北市")] });
  const tour = culture("tour", { title: "巡演", sessions: [session(day(1), "臺北市"), session(day(9), "高雄市")] });
  const unknown = culture("unknown", { sessions: [session(day(2), null)] });
  const kaohsiungRow = stored("ks", { city: "高雄市" });
  const taipeiExpo = stored("expo", { category: "exhibition", city: "臺北市", starts_on: day(-10), ends_on: day(40), show_times: [] });

  it("演出、展覽都只剩該縣市；沒有縣市資料的不出現；巡演選該縣市那一場", () => {
    const pool = buildEventPool({ culture: [taipei, tour, unknown], stored: [kaohsiungRow, taipeiExpo], today: TODAY, city: "高雄市" });
    expect(uids(pool.main.live).sort()).toEqual(["kktix:ks", "tour"]);
    expect(pool.main.live.find((event) => event.uid === "tour")?.session.start).toBe(day(9));
    expect(pool.main.exhibition).toEqual([]);
  });

  it("縣市選項看全部（不受目前選的縣市影響），多的在前", () => {
    const pool = buildEventPool({ culture: [taipei, tour, unknown], stored: [kaohsiungRow, taipeiExpo], today: TODAY, city: "高雄市" });
    expect(pool.cities).toEqual(["臺北市", "高雄市"]);
  });

  it("上限照舊，但在該縣市內取", () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      stored(`r${index}`, { city: index % 2 ? "臺中市" : "臺北市", norm_key: `r${index}`, source: index % 3 ? "kktix" : "opentix" }),
    );
    const pool = buildEventPool({ culture: [], stored: rows, today: TODAY, city: "臺中市" });
    expect(pool.main.live).toHaveLength(15);
    expect(pool.main.live.every((event) => event.sessions.every((item) => item.city === "臺中市"))).toBe(true);
    const all = buildEventPool({ culture: [], stored: rows, today: TODAY, city: null });
    expect(all.main.live).toHaveLength(MERGED_LIMITS.live);
  });
});

describe("buildEventPool：演出細類各自取上限（在總上限之前）", () => {
  it("一般演出佔滿 16 張時，戲劇、舞蹈還是拿得到", () => {
    const general = Array.from({ length: 20 }, (_, index) =>
      stored(`g${index}`, { category: "performance", norm_key: `g${index}`, starts_on: day(1), ends_on: day(1), show_times: [{ date: day(1), time: "19:00" }] }),
    );
    const theatre = stored("t1", { category: "theatre", norm_key: "t1", starts_on: day(20), ends_on: day(20), show_times: [{ date: day(20), time: "19:00" }] });
    const dance = culture("d1", { category: "dance", sessions: [session(day(25), "臺北市")] });
    const pool = buildEventPool({ culture: [dance], stored: [...general, theatre], today: TODAY, city: null });
    expect(uids(pool.main.live)).not.toContain("kktix:t1");
    expect(uids(pool.liveBySubcategory)).toEqual(["kktix:t1", "d1"]);
  });

  it("細類也照縣市過濾", () => {
    const theatre = stored("t1", { category: "theatre", norm_key: "t1", city: "臺南市" });
    const pool = buildEventPool({ culture: [], stored: [theatre], today: TODAY, city: "臺北市" });
    expect(pool.liveBySubcategory).toEqual([]);
  });

  it("文化部細類不受文化部舊上限 12 影響", () => {
    const concerts = Array.from({ length: 14 }, (_, index) => culture(`k${index}`, { category: "concert", sessions: [session(day(index), "臺北市")] }));
    const pool = buildEventPool({ culture: concerts, stored: [], today: TODAY, city: null });
    expect(pool.liveBySubcategory).toHaveLength(12);
  });
});
