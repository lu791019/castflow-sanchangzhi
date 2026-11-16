import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { taipeiDateKey } from "../../src/lib/journal/time.ts";
import { runEventsCollection } from "./run.ts";

const seenAtCollect: string[] = [];
const statePathRef = { current: "" };

vi.mock("./sources.ts", () => ({
  SOURCE_COLLECTORS: new Proxy(
    {},
    {
      get: () => async () => {
        seenAtCollect.push(await readFile(statePathRef.current, "utf8"));
        throw new Error("列表 回應 503");
      },
    },
  ),
}));

describe("runEventsCollection", () => {
  it("開跑前只記今天試過、不動 lastRunDay；整輪失敗後 lastRunDay 仍是舊的", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "events-run-"));
    statePathRef.current = path.join(dir, "events-state.json");
    await writeFile(statePathRef.current, JSON.stringify({ lastRunDay: "2026-10-01", pages: {} }), "utf8");
    const today = taipeiDateKey(new Date());

    const reports = await runEventsCollection({
      api: { ingestEvents: vi.fn() },
      notify: vi.fn(async () => ({ at: "", level: "warn" as const, title: "", detail: "" })),
      log: () => undefined,
      statePath: statePathRef.current,
      intervalDays: 7,
      sources: ["tfam"],
    });

    expect(reports?.every((report) => !report.ok)).toBe(true);
    expect(JSON.parse(seenAtCollect[0])).toMatchObject({ lastRunDay: "2026-10-01", lastAttemptDay: today });
    expect(JSON.parse(await readFile(statePathRef.current, "utf8"))).toMatchObject({ lastRunDay: "2026-10-01", lastAttemptDay: today });
  });
});
