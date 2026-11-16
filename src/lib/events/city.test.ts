import { describe, expect, it } from "vitest";
import { cityFromAddress } from "./collected";
import { cityShortName, narrowToCity, normalizeCity, rankCities, TAIWAN_CITIES } from "./city";
import type { CultureEvent, CultureSession } from "./culture";

const TODAY = "2026-10-15";

function session(start: string, city: string | null, overrides: Partial<CultureSession> = {}): CultureSession {
  return { start, end: null, time: "19:30", venue: "某場地", city, ...overrides };
}

function event(uid: string, sessions: CultureSession[], overrides: Partial<CultureEvent> = {}): CultureEvent {
  return { uid, kind: "live", festival: false, title: uid, imageUrl: null, link: null, sessions, ...overrides };
}

describe("TAIWAN_CITIES：22 縣市，一律寫「臺」", () => {
  it("22 個、不含「台」", () => {
    expect(TAIWAN_CITIES).toHaveLength(22);
    expect(TAIWAN_CITIES.some((city) => city.includes("台"))).toBe(false);
  });
});

describe("normalizeCity：API 與 settings 的縣市白名單", () => {
  it("白名單內原樣；「台」正規化成「臺」；前後空白去掉", () => {
    expect(normalizeCity("臺北市")).toBe("臺北市");
    expect(normalizeCity("台中市")).toBe("臺中市");
    expect(normalizeCity(" 台東縣 ")).toBe("臺東縣");
    expect(normalizeCity("連江縣")).toBe("連江縣");
  });

  it("不在白名單、簡寫、非字串 → null", () => {
    expect(normalizeCity("台北")).toBeNull();
    expect(normalizeCity("東京都")).toBeNull();
    expect(normalizeCity("")).toBeNull();
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity(42)).toBeNull();
    expect(normalizeCity(["臺北市"])).toBeNull();
  });
});

describe("cityFromAddress（文化部 showInfo.location 推縣市）", () => {
  it("完整地址、「台」寫法、簡寫開頭都對得到；看不出來回 null", () => {
    expect(cityFromAddress("台北市中正區中山南路21-1號")).toBe("臺北市");
    expect(cityFromAddress("高雄市鹽埕區大勇路1號")).toBe("高雄市");
    expect(cityFromAddress("北市中山區")).toBe("臺北市");
    expect(cityFromAddress("國家音樂廳")).toBeNull();
    expect(cityFromAddress("")).toBeNull();
  });
});

describe("narrowToCity：只留該縣市的場次", () => {
  const tour = event("tour", [session("2026-10-20", "臺北市"), session("2026-10-25", "高雄市")]);
  const unknown = event("unknown", [session("2026-10-20", null)]);
  const legacy = event("legacy", [{ start: "2026-10-20", end: null, time: null, venue: null }]);

  it("沒選縣市 → 原樣（含沒有縣市資料的）", () => {
    expect(narrowToCity([tour, unknown, legacy], null)).toEqual([tour, unknown, legacy]);
  });

  it("選了縣市 → 巡演只留該縣市的場次；沒有縣市資料的不出現", () => {
    const narrowed = narrowToCity([tour, unknown, legacy], "高雄市");
    expect(narrowed.map((item) => item.uid)).toEqual(["tour"]);
    expect(narrowed[0].sessions).toEqual([session("2026-10-25", "高雄市")]);
  });

  it("不改到原本的活動", () => {
    narrowToCity([tour], "臺北市");
    expect(tour.sessions).toHaveLength(2);
  });
});

describe("rankCities：30 天內有出門類活動的縣市，多的在前", () => {
  it("只算窗內場次；同一活動在一個縣市只算一次；同數照縣市順序", () => {
    const events = [
      event("a", [session("2026-10-20", "高雄市"), session("2026-10-21", "高雄市")]),
      event("b", [session("2026-10-22", "高雄市")]),
      event("c", [session("2026-10-22", "臺南市")]),
      event("d", [session("2026-10-23", "臺北市")]),
      // 窗外（30 天後）、已結束、沒有縣市：都不算
      event("far", [session("2026-12-30", "花蓮縣")]),
      event("past", [session("2026-09-01", "宜蘭縣")]),
      event("none", [session("2026-10-20", null)]),
    ];
    expect(rankCities(events, TODAY)).toEqual(["高雄市", "臺北市", "臺南市"]);
  });

  it("展覽進行中也算", () => {
    const expo = event("expo", [session("2026-09-01", "臺中市", { end: "2026-11-30", time: null })], { kind: "exhibition" });
    expect(rankCities([expo], TODAY)).toEqual(["臺中市"]);
  });
});

describe("cityShortName：卡片 meta 的縣市簡稱", () => {
  it("去掉「市／縣」", () => {
    expect(["臺北市", "高雄市", "新北市", "宜蘭縣", "連江縣"].map(cityShortName)).toEqual(["臺北", "高雄", "新北", "宜蘭", "連江"]);
  });

  it("新竹、嘉義市縣同名：市寫簡稱、縣保留「縣」", () => {
    expect(["新竹市", "新竹縣", "嘉義市", "嘉義縣"].map(cityShortName)).toEqual(["新竹", "新竹縣", "嘉義", "嘉義縣"]);
  });

  it("22 縣市簡稱都分得出來", () => {
    expect(new Set(TAIWAN_CITIES.map(cityShortName)).size).toBe(22);
  });
});
