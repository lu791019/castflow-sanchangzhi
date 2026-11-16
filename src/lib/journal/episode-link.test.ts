import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import {
  JournalLinkError,
  linkJournalToEpisode,
  loadEpisodeJournal,
  markJournalSaidForEpisode,
} from "./episode-link";

const JOURNAL_ID = "11111111-1111-1111-1111-111111111111";
const EPISODE_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";

interface Call {
  method: string;
  args: unknown[];
}

/** 記錄 query builder 呼叫鏈；結尾（maybeSingle／select 後 await）回傳 result */
function mockClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "update", "eq", "neq", "select", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => result;
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  vi.mocked(createAdminClient).mockReturnValue(builder as unknown as ReturnType<typeof createAdminClient>);
  return calls;
}

const find = (calls: Call[], method: string) => calls.filter((call) => call.method === method);

describe("linkJournalToEpisode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("只寫 episode_id（status 不動）", async () => {
    const calls = mockClient({ data: { id: JOURNAL_ID }, error: null });
    await linkJournalToEpisode(USER_ID, JOURNAL_ID, EPISODE_ID);
    expect(find(calls, "update")[0].args[0]).toEqual({ episode_id: EPISODE_ID });
    expect(find(calls, "eq")[0].args).toEqual(["id", JOURNAL_ID]);
    expect(find(calls, "eq")[1].args).toEqual(["user_id", USER_ID]);
  });

  it("找不到紀錄或格式錯誤 → JournalLinkError", async () => {
    mockClient({ data: null, error: null });
    await expect(linkJournalToEpisode(USER_ID, JOURNAL_ID, EPISODE_ID)).rejects.toThrow(JournalLinkError);
    await expect(linkJournalToEpisode(USER_ID, "bad", EPISODE_ID)).rejects.toThrow("格式不正確");
  });
});

describe("markJournalSaidForEpisode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("把連到這篇的紀錄標 said 並寫入 episode_id", async () => {
    const calls = mockClient({ data: [{ id: JOURNAL_ID }], error: null });
    expect(await markJournalSaidForEpisode(USER_ID, EPISODE_ID)).toBe(1);
    expect(find(calls, "update")[0].args[0]).toEqual({ status: "said", episode_id: EPISODE_ID });
    expect(find(calls, "eq")[0].args).toEqual(["episode_id", EPISODE_ID]);
    expect(find(calls, "eq")[1].args).toEqual(["user_id", USER_ID]);
    expect(find(calls, "neq")[0].args).toEqual(["status", "said"]);
  });

  it("沒有連結的紀錄 → 0；DB 錯誤 → 拋出", async () => {
    mockClient({ data: [], error: null });
    expect(await markJournalSaidForEpisode(USER_ID, EPISODE_ID)).toBe(0);
    mockClient({ data: null, error: { message: "db down" } });
    await expect(markJournalSaidForEpisode(USER_ID, EPISODE_ID)).rejects.toThrow("db down");
  });

  it("無效 episodeId 不查 DB", async () => {
    expect(await markJournalSaidForEpisode(USER_ID, "bad")).toBe(0);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("loadEpisodeJournal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("讀回署名資料", async () => {
    mockClient({
      data: { id: JOURNAL_ID, experienced_at: "2026-10-07T13:30:00Z", venue: "cinema", works: null },
      error: null,
    });
    expect(await loadEpisodeJournal(EPISODE_ID)).toEqual({
      journalId: JOURNAL_ID,
      experiencedAt: "2026-10-07T13:30:00Z",
      venue: "cinema",
      verb: "看完",
    });
  });

  it("沒有連結 → null；讀取失敗記 log 並回 null", async () => {
    mockClient({ data: null, error: null });
    expect(await loadEpisodeJournal(EPISODE_ID)).toBeNull();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClient({ data: null, error: { message: "db down" } });
    expect(await loadEpisodeJournal(EPISODE_ID)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
