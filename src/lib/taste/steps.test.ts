import { describe, expect, it } from "vitest";
import { asksCity, asksLiveKinds, tasteSteps } from "./steps";

describe("tasteSteps：問卷要問哪幾題（Q-63）", () => {
  it("沒勾演出也沒勾展覽：跟以前一樣 3 題", () => {
    expect(tasteSteps([])).toEqual(["media", "setting", "picks"]);
    expect(tasteSteps(["movie", "series", "podcast", "music"])).toEqual(["media", "setting", "picks"]);
  });

  it("勾了演出：5 題（④縣市、⑤演出想看哪種）", () => {
    expect(tasteSteps(["live"])).toEqual(["media", "setting", "picks", "city", "live"]);
    expect(tasteSteps(["movie", "live", "exhibition"])).toEqual(["media", "setting", "picks", "city", "live"]);
  });

  it("只勾展覽：4 題（問縣市、不問演出種類）", () => {
    expect(tasteSteps(["exhibition"])).toEqual(["media", "setting", "picks", "city"]);
  });
});

describe("asksCity／asksLiveKinds", () => {
  it("縣市：演出或展覽", () => {
    expect(asksCity(["live"])).toBe(true);
    expect(asksCity(["exhibition"])).toBe(true);
    expect(asksCity(["movie", "music"])).toBe(false);
  });

  it("演出種類：只有演出", () => {
    expect(asksLiveKinds(["live"])).toBe(true);
    expect(asksLiveKinds(["exhibition"])).toBe(false);
    expect(asksLiveKinds([])).toBe(false);
  });
});
