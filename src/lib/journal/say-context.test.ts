import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { loadJournalForSay, toSayContext } from "./say-context";
import type { JournalEntry } from "./types";
import type { Work } from "@/lib/works/format";

const ENTRY: JournalEntry = {
  id: "11111111-1111-1111-1111-111111111111",
  work_id: null,
  work_title_fallback: "只記名稱",
  experienced_at: "2026-10-07T13:00:00Z",
  venue: "cinema",
  companions: null,
  rating: null,
  status: "recorded",
  episode_id: null,
  remind_at: null,
  reminded_at: null,
  created_at: "2026-10-07T13:05:00Z",
};

describe("toSayContext", () => {
  it("只記名稱 → 用 fallback 名稱、場域動詞", () => {
    expect(toSayContext(ENTRY, null)).toMatchObject({
      workTitle: "只記名稱",
      verb: "看完",
      alreadySaid: false,
      work: null,
    });
  });

  it("Podcast 作品 → 節目名 + 聽完", () => {
    const work = { kind: "podcast_episode", title: "Ep 1", podcast_show: "The Daily" } as Work;
    expect(toSayContext({ ...ENTRY, work_id: "w" }, work)).toMatchObject({
      workTitle: "The Daily",
      verb: "聽完",
    });
  });

  it("排行程（建立早於場次）：帶散場時間，作品有片長就用", () => {
    const planned = { ...ENTRY, created_at: "2026-10-06T00:00:00Z" };
    expect(toSayContext(planned, null).settleAt).toBe("2026-10-07T15:25:00.000Z");
    const movie = { kind: "movie", title: "海街日記", podcast_show: null } as unknown as Work;
    expect(toSayContext({ ...planned, work_id: "w" }, movie, 100).settleAt).toBe("2026-10-07T14:55:00.000Z");
  });

  it("事後補記、影集：沒有散場時間", () => {
    expect(toSayContext(ENTRY, null).settleAt).toBeNull();
    const series = { kind: "series", title: "影集", podcast_show: null } as unknown as Work;
    expect(toSayContext({ ...ENTRY, created_at: "2026-10-06T00:00:00Z", work_id: "w" }, series).settleAt).toBeNull();
  });

  it("已說過標記 alreadySaid", () => {
    expect(toSayContext({ ...ENTRY, status: "said" }, null).alreadySaid).toBe(true);
  });
});

describe("loadJournalForSay", () => {
  it.each([null, undefined, "", "not-a-uuid"])("無效 id %s → null，不查 DB", async (id) => {
    expect(await loadJournalForSay("u-1", id)).toBeNull();
  });
});
