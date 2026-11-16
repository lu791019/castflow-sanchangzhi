import { describe, expect, it } from "vitest";
import { LOG_DRAFT_TTL_MS, LOG_DRAFT_VERSION, logResumePath, parseLogDraft, type LogDraft } from "./log-draft";

const NOW = new Date("2026-10-14T13:00:00Z");

const draft = (overrides: Partial<LogDraft> = {}): LogDraft => ({
  version: LOG_DRAFT_VERSION,
  savedAt: "2026-10-14T12:55:00Z",
  work: { id: "w1", kind: "movie", title: "海街日記", podcast_show: null, episode_number: null, poster_url: "https://img/p.jpg" },
  when: "now",
  custom: "",
  place: "cinema",
  companions: "和姊姊",
  live: { name: "", venue: "", dates: "", venueType: "", ticketUrl: "", coverUrl: "" },
  ...overrides,
});

describe("parseLogDraft（訪客記一筆：登入回來還原，UX-03）", () => {
  it("合法草稿原樣還原", () => {
    expect(parseLogDraft(JSON.stringify(draft()), NOW)).toEqual(draft());
  });

  it("場外：沒有作品、有演出名也算", () => {
    const live = draft({ work: null, place: "live", live: { name: "草東沒有派對", venue: "Legacy", dates: "10/20", venueType: "", ticketUrl: "", coverUrl: "" } });
    expect(parseLogDraft(JSON.stringify(live), NOW)).toEqual(live);
  });

  it("超過一天、版本不同、壞 JSON、空值一律當沒有", () => {
    const stale = draft({ savedAt: new Date(NOW.getTime() - LOG_DRAFT_TTL_MS - 1000).toISOString() });
    expect(parseLogDraft(JSON.stringify(stale), NOW)).toBeNull();
    expect(parseLogDraft(JSON.stringify({ ...draft(), version: 99 }), NOW)).toBeNull();
    expect(parseLogDraft("{not json", NOW)).toBeNull();
    expect(parseLogDraft(null, NOW)).toBeNull();
  });

  it("欄位不合法（場域、時間選項、作品類型）就不還原", () => {
    expect(parseLogDraft(JSON.stringify({ ...draft(), place: "moon" }), NOW)).toBeNull();
    expect(parseLogDraft(JSON.stringify({ ...draft(), when: "someday" }), NOW)).toBeNull();
    expect(parseLogDraft(JSON.stringify({ ...draft(), work: { ...draft().work, kind: "book" } }), NOW)).toBeNull();
  });

  it("什麼都沒填（沒作品、沒演出名、沒地點）不值得還原", () => {
    expect(parseLogDraft(JSON.stringify(draft({ work: null, place: null })), NOW)).toBeNull();
  });
});

describe("logResumePath", () => {
  it("登入後回到記一筆並帶 resume", () => {
    expect(logResumePath()).toBe(`/login?next=${encodeURIComponent("/journal/new?resume=1")}`);
  });
});
