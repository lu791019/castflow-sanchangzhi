import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listDue = vi.fn(async () => []);
vi.mock("./spotify-db.ts", () => ({
  listDueConnections: (...args: unknown[]) => listDue(...(args as [])),
  insertListenPrompt: vi.fn(),
  markConnectionPolled: vi.fn(),
  markConnectionRevoked: vi.fn(),
  saveRotatedRefreshToken: vi.fn(),
}));

const { createListenRunner } = await import("./spotify-listen-run.ts");
type ListenConfig = import("./config.ts").WorkerConfig["spotifyListen"];
type Notify = import("./notify.ts").Notify;

const CONFIG: ListenConfig = {
  enabled: true,
  intervalMs: 20 * 60_000,
  credentials: { clientId: "id", clientSecret: "secret" },
  tokenKey: randomBytes(32),
  problem: null,
};

function runner(config: ListenConfig = CONFIG, now = () => 0) {
  return createListenRunner({ config, db: {} as never, notify: vi.fn() as unknown as Notify, sendPush: null, log: vi.fn(), now });
}

describe("createListenRunner", () => {
  beforeEach(() => listDue.mockClear());

  it("沒開、缺 client、缺金鑰 → null（停用）", () => {
    expect(runner({ ...CONFIG, enabled: false })).toBeNull();
    expect(runner({ ...CONFIG, credentials: null })).toBeNull();
    expect(runner({ ...CONFIG, tokenKey: null })).toBeNull();
  });

  it("依間隔自己決定要不要拉：第一次就拉，間隔內直接返回，過了再拉", async () => {
    let now = 1_000_000_000;
    const poll = runner(CONFIG, () => now);
    await poll?.();
    expect(listDue).toHaveBeenCalledTimes(1);
    now += 60_000;
    await poll?.();
    expect(listDue).toHaveBeenCalledTimes(1);
    now += CONFIG.intervalMs;
    await poll?.();
    expect(listDue).toHaveBeenCalledTimes(2);
  });
});
