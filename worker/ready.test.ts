import { describe, expect, it, vi } from "vitest";
import { processReadyNotifications, readyPushPayload, type ReadyDeps, type ReadyEpisode } from "./ready.ts";
import type { StoredPushSubscription } from "./reminders.ts";

const EPISODE: ReadyEpisode = { episodeId: "ep-1", userId: "user-a", workTitle: "海街日記" };
const SUB: StoredPushSubscription = { endpoint: "https://push.example/a", keys: { p256dh: "p", auth: "a" }, userId: "user-a" };

function makeDeps(overrides: Partial<ReadyDeps> = {}): ReadyDeps {
  return {
    fetchReady: vi.fn(async () => [EPISODE]),
    claim: vi.fn(async () => true),
    listSubscriptions: vi.fn(async () => [SUB]),
    sendPush: vi.fn(async () => ({ ok: true as const })),
    removeSubscription: vi.fn(async () => {}),
    notify: vi.fn(async (level, title, detail) => ({ at: "t", level, title, detail: detail ?? "" })),
    ...overrides,
  };
}

describe("readyPushPayload", () => {
  it("有作品：時間＋作品當標題，點開進校樣，App 開著不跳", () => {
    expect(readyPushPayload(EPISODE)).toEqual({
      title: "剛剛說的《海街日記》",
      body: "整理好了，校樣在等你看。",
      url: "/proof/ep-1",
      tag: "say-ready-ep-1",
      quietIfOpen: true,
    });
  });

  it("沒連作品：剛剛說的那段", () => {
    expect(readyPushPayload({ ...EPISODE, workTitle: null }).title).toBe("剛剛說的那段");
  });
});

describe("processReadyNotifications", () => {
  it("搶到 → 只推給擁有者", async () => {
    const other = { ...SUB, endpoint: "https://push.example/b", userId: "user-b" };
    const deps = makeDeps({ listSubscriptions: vi.fn(async () => [SUB, other]) });
    expect(await processReadyNotifications(deps)).toEqual({ ready: 1, pushed: 1, pushFailed: 0 });
    expect(deps.sendPush).toHaveBeenCalledWith(SUB, expect.objectContaining({ url: "/proof/ep-1" }));
    expect(deps.sendPush).toHaveBeenCalledTimes(1);
  });

  it("沒搶到（別輪已推）→ 不推", async () => {
    const deps = makeDeps({ claim: vi.fn(async () => false) });
    expect(await processReadyNotifications(deps)).toEqual({ ready: 1, pushed: 0, pushFailed: 0 });
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("搶寫失敗 → error 警報、不推（下輪重試）", async () => {
    const deps = makeDeps({ claim: vi.fn(async () => Promise.reject(new Error("db down"))) });
    await processReadyNotifications(deps);
    expect(deps.sendPush).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith("error", expect.stringContaining("ready_notified_at"), expect.anything());
  });

  it("讀清單失敗 → warn；沒有待推 → 不讀訂閱", async () => {
    const failing = makeDeps({ fetchReady: vi.fn(async () => Promise.reject(new Error("x"))) });
    expect(await processReadyNotifications(failing)).toEqual({ ready: 0, pushed: 0, pushFailed: 0 });
    expect(failing.notify).toHaveBeenCalledWith("warn", expect.anything(), "x");
    const empty = makeDeps({ fetchReady: vi.fn(async () => []) });
    await processReadyNotifications(empty);
    expect(empty.listSubscriptions).not.toHaveBeenCalled();
  });

  it("VAPID 未設定（sendPush null）→ 仍搶寫，不推", async () => {
    const deps = makeDeps({ sendPush: null });
    expect(await processReadyNotifications(deps)).toEqual({ ready: 1, pushed: 0, pushFailed: 0 });
    expect(deps.claim).toHaveBeenCalledWith("ep-1");
  });
});
