import { describe, expect, it } from "vitest";
import type { JournalSayContext } from "@/lib/journal/say-context";
import type { JournalEntry } from "@/lib/journal/types";
import type { Work } from "@/lib/works/format";
import { JOURNAL_PREFILL_NOTE, toJournalPrefill } from "./journal-prefill";

const ENTRY: JournalEntry = {
  id: "11111111-1111-1111-1111-111111111111",
  work_id: null,
  work_title_fallback: "只記名稱",
  experienced_at: "2026-10-07T13:30:00Z",
  venue: "cinema",
  companions: null,
  rating: null,
  status: "recorded",
  episode_id: null,
  remind_at: null,
  reminded_at: null,
  created_at: "2026-10-07T13:35:00Z",
};

function context(overrides: Partial<JournalSayContext>): JournalSayContext {
  return { entry: ENTRY, work: null, workTitle: "只記名稱", verb: "看完", alreadySaid: false, ...overrides };
}

describe("toJournalPrefill", () => {
  it("只記名稱：帶 journalId、場域分類、看完時刻", () => {
    expect(toJournalPrefill(context({}))).toMatchObject({
      id: ENTRY.id,
      journalId: ENTRY.id,
      workId: null,
      workTitle: "只記名稱",
      categoryLabel: "電影院",
      createdAt: ENTRY.experienced_at,
      verb: "看",
      note: JOURNAL_PREFILL_NOTE,
      posterUrl: null,
    });
  });

  it("散場提醒點進來（排行程）：從散場時間起算，不是開演時間", () => {
    expect(toJournalPrefill(context({ settleAt: "2026-10-07T15:55:00.000Z" })).createdAt).toBe("2026-10-07T15:55:00.000Z");
  });

  it("綁作品：帶 workId、作品分類與海報", () => {
    const work = { id: "w1", kind: "movie", title: "海街日記", poster_url: "https://p/x.jpg" } as Work;
    expect(
      toJournalPrefill(context({ entry: { ...ENTRY, work_id: "w1" }, work, workTitle: "海街日記" })),
    ).toMatchObject({ workId: "w1", categoryLabel: "電影", posterUrl: "https://p/x.jpg", verb: "看" });
  });

  it("Podcast：聽、副標為單集名", () => {
    const work = { id: "w2", kind: "podcast_episode", title: "Ep 9", podcast_show: "Show", poster_url: null } as Work;
    expect(
      toJournalPrefill(context({ entry: { ...ENTRY, work_id: "w2" }, work, workTitle: "Show", verb: "聽完" })),
    ).toMatchObject({ verb: "聽", note: "Ep 9", workTitle: "Show" });
  });
});
