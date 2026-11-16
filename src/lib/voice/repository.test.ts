import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { addPastedSample, deleteVoiceSample, recordSpokenSample, TooManySamplesError } from "./repository";
import { MAX_PASTED_SAMPLES } from "./samples";

const USER_ID = "33333333-3333-3333-3333-333333333333";
const EPISODE_ID = "22222222-2222-2222-2222-222222222222";

interface Call {
  method: string;
  args: unknown[];
}

type Result = { data?: unknown; error: { message: string } | null; count?: number };

/** 記錄 query builder 呼叫鏈；每次 await（或 single）依序吐出 results */
function mockClient(results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const next = () => queue.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "insert", "upsert", "delete", "eq", "neq", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.single = async () => next();
  builder.then = (resolve: (value: unknown) => unknown) => resolve(next());
  vi.mocked(createAdminClient).mockReturnValue(builder as unknown as ReturnType<typeof createAdminClient>);
  return calls;
}

const find = (calls: Call[], method: string) => calls.filter((call) => call.method === method);

describe("addPastedSample", () => {
  beforeEach(() => vi.clearAllMocks());

  it("以本人 userId 計數並寫入 paste", async () => {
    const calls = mockClient([{ count: 2, error: null }, { data: { id: "x" }, error: null }]);
    await addPastedSample(USER_ID, "我的貼文");
    expect(find(calls, "eq")[0].args).toEqual(["user_id", USER_ID]);
    expect(find(calls, "insert")[0].args[0]).toEqual({ user_id: USER_ID, body: "我的貼文", source: "paste" });
  });

  it(`滿 ${MAX_PASTED_SAMPLES} 篇擋下`, async () => {
    mockClient([{ count: MAX_PASTED_SAMPLES, error: null }]);
    await expect(addPastedSample(USER_ID, "我的貼文")).rejects.toThrow(TooManySamplesError);
  });
});

describe("deleteVoiceSample", () => {
  beforeEach(() => vi.clearAllMocks());

  it("同時比對 id 與 user_id（刪不到別人的）", async () => {
    const calls = mockClient([{ data: [], error: null }]);
    expect(await deleteVoiceSample(USER_ID, "sample-id")).toBe(false);
    expect(find(calls, "eq").map((call) => call.args)).toEqual([
      ["id", "sample-id"],
      ["user_id", USER_ID],
    ]);
  });
});

describe("recordSpokenSample", () => {
  beforeEach(() => vi.clearAllMocks());

  it("收逐字稿、同一段只收一次", async () => {
    const calls = mockClient([{ data: null, error: null }]);
    await recordSpokenSample(USER_ID, EPISODE_ID, "  " + "這部片".repeat(10) + "  ");
    const [row, options] = find(calls, "upsert")[0].args;
    expect(row).toEqual({ user_id: USER_ID, episode_id: EPISODE_ID, body: "這部片".repeat(10), source: "spoken" });
    expect(options).toEqual({ onConflict: "episode_id", ignoreDuplicates: true });
  });

  it("太短不收、不打 DB", async () => {
    const calls = mockClient([]);
    await recordSpokenSample(USER_ID, EPISODE_ID, "好看");
    expect(calls).toHaveLength(0);
  });
});
