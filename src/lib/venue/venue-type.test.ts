import { describe, expect, it } from "vitest";
import { isVenueTypeFor, parseVenueType, VENUE_TYPE_OPTIONS, venueTypeLabel } from "./venue-type";

describe("場館類型兩層（Q-36）", () => {
  it("演出五種、展覽四種，順序照設計", () => {
    expect(VENUE_TYPE_OPTIONS.live.map((option) => option.value)).toEqual([
      "concert_hall",
      "theater",
      "livehouse",
      "festival",
      "arena",
    ]);
    expect(VENUE_TYPE_OPTIONS.exhibition.map((option) => option.value)).toEqual([
      "museum",
      "history_museum",
      "gallery",
      "special",
    ]);
  });

  it("標籤", () => {
    expect(venueTypeLabel("livehouse")).toBe("Live House");
    expect(venueTypeLabel("history_museum")).toBe("博物館");
    expect(venueTypeLabel(null)).toBeNull();
  });

  it("演出的類型不能掛在展覽上，反之亦然", () => {
    expect(isVenueTypeFor("live", "arena")).toBe(true);
    expect(isVenueTypeFor("exhibition", "arena")).toBe(false);
    expect(isVenueTypeFor("exhibition", "gallery")).toBe(true);
    expect(isVenueTypeFor("live", "gallery")).toBe(false);
  });

  it("parseVenueType：空值為 null；不合法回錯誤", () => {
    expect(parseVenueType("live", undefined)).toEqual({ ok: true, value: null });
    expect(parseVenueType("live", "")).toEqual({ ok: true, value: null });
    expect(parseVenueType("live", "festival")).toEqual({ ok: true, value: "festival" });
    expect(parseVenueType("live", "museum").ok).toBe(false);
    expect(parseVenueType("exhibition", 3).ok).toBe(false);
  });
});
