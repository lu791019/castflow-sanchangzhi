import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/journal/repository", () => ({ createJournalEntry: vi.fn() }));
vi.mock("@/lib/proof/load", () => ({ loadProofData: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { createJournalEntry } from "@/lib/journal/repository";
import { startWatchedEntry, WatchedInputError } from "./repository";

const USER_ID = "33333333-3333-3333-3333-333333333333";
const JOURNAL_ID = "11111111-1111-1111-1111-111111111111";
const WORK_ID = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-10-26T14:00:00Z");

interface Call {
  method: string;
  args: unknown[];
}

function mockClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "update", "eq", "is", "select"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => result;
  vi.mocked(createAdminClient).mockReturnValue(builder as unknown as ReturnType<typeof createAdminClient>);
  return calls;
}

const base = { journalId: null, workId: WORK_ID, workTitle: null, rating: 4.5, venue: "cinema" as const, companions: null };

describe("startWatchedEntry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("新建：現在看過、帶星等", async () => {
    vi.mocked(createJournalEntry).mockResolvedValue({ id: "new-id" } as Awaited<ReturnType<typeof createJournalEntry>>);
    await expect(startWatchedEntry(USER_ID, base, NOW)).resolves.toBe("new-id");
    expect(vi.mocked(createJournalEntry).mock.calls[0][1]).toMatchObject({
      workId: WORK_ID,
      rating: 4.5,
      venue: "cinema",
      status: "recorded",
      experiencedAt: NOW,
    });
  });

  it("沿用日誌：只限本人、看過、還沒說", async () => {
    const calls = mockClient({ data: { id: JOURNAL_ID }, error: null });
    await expect(startWatchedEntry(USER_ID, { ...base, journalId: JOURNAL_ID }, NOW)).resolves.toBe(JOURNAL_ID);
    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({ rating: 4.5, venue: "cinema", companions: null });
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["id", JOURNAL_ID],
      ["user_id", USER_ID],
      ["status", "recorded"],
    ]);
    expect(calls.find((c) => c.method === "is")?.args).toEqual(["episode_id", null]);
    expect(createJournalEntry).not.toHaveBeenCalled();
  });

  it("沿用失敗（別人的或已說過）→ WatchedInputError", async () => {
    mockClient({ data: null, error: null });
    await expect(startWatchedEntry(USER_ID, { ...base, journalId: JOURNAL_ID }, NOW)).rejects.toThrow(WatchedInputError);
  });

  it("沒有作品也沒有名稱 → WatchedInputError", async () => {
    await expect(startWatchedEntry(USER_ID, { ...base, workId: null }, NOW)).rejects.toThrow(WatchedInputError);
  });
});
