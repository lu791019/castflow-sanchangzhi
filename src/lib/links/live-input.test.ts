import { describe, expect, it } from "vitest";
import { parseLiveLinkExtras } from "./live-input";

describe("parseLiveLinkExtras（記一筆場外：場館類型＋售票網址）", () => {
  it("都沒填 → 都是 null", () => {
    expect(parseLiveLinkExtras({}, "live")).toEqual({ ok: true, value: { venueType: null, ticketUrl: null } });
    expect(parseLiveLinkExtras({ liveVenueType: "", liveTicketUrl: "  " }, "exhibition")).toEqual({
      ok: true,
      value: { venueType: null, ticketUrl: null },
    });
  });

  it("合法值", () => {
    expect(parseLiveLinkExtras({ liveVenueType: "livehouse", liveTicketUrl: " https://kktix.com/events/x " }, "live")).toEqual({
      ok: true,
      value: { venueType: "livehouse", ticketUrl: "https://kktix.com/events/x" },
    });
  });

  it("類型不屬於這一層、網址不是 http(s) → 錯誤", () => {
    expect(parseLiveLinkExtras({ liveVenueType: "museum" }, "live")).toEqual({ ok: false, error: "場館類型不在選項裡" });
    expect(parseLiveLinkExtras({ liveTicketUrl: "javascript:x" }, "live")).toEqual({ ok: false, error: "售票網址要是 http 或 https 開頭" });
    expect(parseLiveLinkExtras({ liveTicketUrl: 5 }, "live").ok).toBe(false);
  });
});
