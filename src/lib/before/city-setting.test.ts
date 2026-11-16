import { describe, expect, it } from "vitest";
import { beforeCityKey, parseCityBody, parseStoredCity } from "./city-setting";

describe("beforeCityKey（每人一列，存在既有 settings 表，同 taste_picks 寫法）", () => {
  it("before_city:<userId>", () => {
    expect(beforeCityKey("u1")).toBe("before_city:u1");
  });
});

describe("parseStoredCity：讀回來的值也要過白名單", () => {
  it("合法縣市；台 → 臺", () => {
    expect(parseStoredCity({ city: "高雄市" })).toBe("高雄市");
    expect(parseStoredCity({ city: "台南市" })).toBe("臺南市");
  });

  it("沒有、null、壞資料 → 全部縣市（null）", () => {
    expect(parseStoredCity(undefined)).toBeNull();
    expect(parseStoredCity(null)).toBeNull();
    expect(parseStoredCity({ city: null })).toBeNull();
    expect(parseStoredCity({ city: "東京都" })).toBeNull();
    expect(parseStoredCity("臺北市")).toBeNull();
  });
});

describe("parseCityBody：POST /api/before/city 的 body", () => {
  it("{ city: 縣市 } → 存該縣市；{ city: null } → 全部縣市", () => {
    expect(parseCityBody({ city: "臺北市" })).toEqual({ ok: true, city: "臺北市" });
    expect(parseCityBody({ city: "台中市" })).toEqual({ ok: true, city: "臺中市" });
    expect(parseCityBody({ city: null })).toEqual({ ok: true, city: null });
  });

  it("不在白名單、少欄位、不是物件 → 不收", () => {
    expect(parseCityBody({ city: "台北" }).ok).toBe(false);
    expect(parseCityBody({ city: "" }).ok).toBe(false);
    expect(parseCityBody({}).ok).toBe(false);
    expect(parseCityBody(null).ok).toBe(false);
    expect(parseCityBody("臺北市").ok).toBe(false);
  });
});
