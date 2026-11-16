import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processReminders,
  resetPushUnconfiguredWarning,
  type DueReminder,
  type ReminderDeps,
  type StoredPushSubscription,
} from "./reminders.ts";

beforeEach(() => resetPushUnconfiguredWarning());

const REMINDER: DueReminder = {
  journalEntryId: "j-1",
  remindAt: "2026-10-08T04:00:00Z",
  title: "昨晚的《海街日記》",
  body: "看完一天了，現在想說說嗎？說一分鐘就好。",
  url: "/say?journal=j-1",
  userId: "user-a",
};

const SUB: StoredPushSubscription = {
  endpoint: "https://push.example/sub-1",
  keys: { p256dh: "p", auth: "a" },
  userId: "user-a",
};

function makeDeps(overrides: Partial<ReminderDeps> = {}): ReminderDeps {
  return {
    fetchDue: vi.fn(async () => [REMINDER]),
    createNotification: vi.fn(async () => true),
    listSubscriptions: vi.fn(async () => [SUB]),
    sendPush: vi.fn(async () => ({ ok: true as const })),
    removeSubscription: vi.fn(async () => {}),
    markReminded: vi.fn(async () => {}),
    notify: vi.fn(async (level, title, detail) => ({ at: "t", level, title, detail: detail ?? "" })),
    ...overrides,
  };
}

describe("processReminders", () => {
  it("正常路徑：建通知 → 推播 → 寫 reminded_at", async () => {
    const deps = makeDeps();
    const result = await processReminders(deps);
    expect(result).toEqual({ due: 1, notified: 1, pushed: 1, pushFailed: 0, marked: 1 });
    expect(deps.createNotification).toHaveBeenCalledWith(REMINDER);
    expect(deps.sendPush).toHaveBeenCalledWith(SUB, {
      title: REMINDER.title,
      body: REMINDER.body,
      url: REMINDER.url,
      tag: "say-reminder-j-1",
    });
    expect(deps.markReminded).toHaveBeenCalledWith("j-1");
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("沒有到期的 → 不讀訂閱、不做事", async () => {
    const deps = makeDeps({ fetchDue: vi.fn(async () => []) });
    expect(await processReminders(deps)).toMatchObject({ due: 0 });
    expect(deps.listSubscriptions).not.toHaveBeenCalled();
  });

  it("讀到期失敗 → warn 警報", async () => {
    const deps = makeDeps({ fetchDue: vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))) });
    expect(await processReminders(deps)).toMatchObject({ due: 0 });
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("到期提醒"), "ECONNREFUSED");
  });

  it("沒有訂閱 → 只建 App 內通知，仍寫 reminded_at", async () => {
    const deps = makeDeps({ listSubscriptions: vi.fn(async () => []) });
    expect(await processReminders(deps)).toEqual({ due: 1, notified: 1, pushed: 0, pushFailed: 0, marked: 1 });
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("有訂閱但 VAPID 未設定 → warn（降級不可靜默），仍建通知", async () => {
    const deps = makeDeps({ sendPush: null });
    const result = await processReminders(deps);
    expect(result).toMatchObject({ notified: 1, pushed: 0, marked: 1 });
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("VAPID"));
  });

  it("通知已存在（上輪建過）→ 不重推，但補寫 reminded_at", async () => {
    const deps = makeDeps({ createNotification: vi.fn(async () => false) });
    expect(await processReminders(deps)).toEqual({ due: 1, notified: 0, pushed: 0, pushFailed: 0, marked: 1 });
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("建通知失敗 → error 警報、不寫 reminded_at（下輪重試）", async () => {
    const deps = makeDeps({ createNotification: vi.fn(async () => Promise.reject(new Error("db down"))) });
    expect(await processReminders(deps)).toMatchObject({ notified: 0, marked: 0 });
    expect(deps.markReminded).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith("error", "建立提醒通知失敗", expect.stringContaining("db down"));
  });

  it("推播 410 → 清訂閱（info），不發 warn", async () => {
    const deps = makeDeps({
      sendPush: vi.fn(async () => ({ ok: false as const, gone: true, message: "410 Gone" })),
    });
    expect(await processReminders(deps)).toMatchObject({ pushed: 0, pushFailed: 1, marked: 1 });
    expect(deps.removeSubscription).toHaveBeenCalledWith(SUB.endpoint);
    expect(deps.notify).toHaveBeenCalledWith("info", expect.stringContaining("失效"), expect.any(String));
    expect(deps.notify).not.toHaveBeenCalledWith("warn", expect.anything(), expect.anything());
  });

  it("推播其他失敗 → warn，仍寫 reminded_at（App 內通知已在）", async () => {
    const deps = makeDeps({
      sendPush: vi.fn(async () => ({ ok: false as const, gone: false, message: "500 boom" })),
    });
    expect(await processReminders(deps)).toMatchObject({ pushFailed: 1, marked: 1 });
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("Web Push"), "500 boom");
  });

  it("讀訂閱失敗 → warn，仍建通知", async () => {
    const deps = makeDeps({ listSubscriptions: vi.fn(async () => Promise.reject(new Error("x"))) });
    expect(await processReminders(deps)).toMatchObject({ notified: 1, pushed: 0, marked: 1 });
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("推播訂閱"), "x");
  });

  it("寫 reminded_at 失敗 → error 警報", async () => {
    const deps = makeDeps({ markReminded: vi.fn(async () => Promise.reject(new Error("lock"))) });
    expect(await processReminders(deps)).toMatchObject({ notified: 1, marked: 0 });
    expect(deps.notify).toHaveBeenCalledWith("error", "寫入 reminded_at 失敗", expect.stringContaining("lock"));
  });

  it("同一位使用者多筆：每筆都建通知，推播合併成一則（每個裝置一次）", async () => {
    const second = { ...REMINDER, journalEntryId: "j-2" };
    const deps = makeDeps({
      fetchDue: vi.fn(async () => [REMINDER, second]),
      listSubscriptions: vi.fn(async () => [SUB, { ...SUB, endpoint: "https://push.example/sub-2" }]),
    });
    expect(await processReminders(deps)).toEqual({ due: 2, notified: 2, pushed: 2, pushFailed: 0, marked: 2 });
    expect(deps.createNotification).toHaveBeenCalledTimes(2);
    expect(deps.listSubscriptions).toHaveBeenCalledTimes(1);
  });

  it("合併推播連到最晚看的那筆，內文補上其餘筆數", async () => {
    const older = { ...REMINDER, journalEntryId: "j-old", experiencedAt: "2026-10-07T12:00:00Z" };
    const latest = {
      ...REMINDER,
      journalEntryId: "j-new",
      title: "昨晚的《花樣年華》",
      url: "/say?journal=j-new",
      experiencedAt: "2026-10-07T14:00:00Z",
    };
    const oldest = { ...REMINDER, journalEntryId: "j-oldest", experiencedAt: "2026-10-07T03:00:00Z" };
    const deps = makeDeps({ fetchDue: vi.fn(async () => [older, latest, oldest]) });
    await processReminders(deps);
    expect(deps.sendPush).toHaveBeenCalledTimes(1);
    expect(deps.sendPush).toHaveBeenCalledWith(SUB, {
      title: "昨晚的《花樣年華》",
      body: `${REMINDER.body}（另有 2 筆在收件匣）`,
      url: "/say?journal=j-new",
      tag: "say-reminder-j-new",
    });
  });

  it("上輪已建過的不算進合併；不同使用者各推各的", async () => {
    const existing = { ...REMINDER, journalEntryId: "j-existing" };
    const otherUser = { ...REMINDER, journalEntryId: "j-b", userId: "user-b" };
    const subB = { ...SUB, endpoint: "https://push.example/b", userId: "user-b" };
    const deps = makeDeps({
      fetchDue: vi.fn(async () => [REMINDER, existing, otherUser]),
      createNotification: vi.fn(async (reminder: DueReminder) => reminder.journalEntryId !== "j-existing"),
      listSubscriptions: vi.fn(async () => [SUB, subB]),
    });
    expect(await processReminders(deps)).toEqual({ due: 3, notified: 2, pushed: 2, pushFailed: 0, marked: 3 });
    expect(deps.sendPush).toHaveBeenCalledWith(SUB, expect.objectContaining({ body: REMINDER.body, tag: "say-reminder-j-1" }));
    expect(deps.sendPush).toHaveBeenCalledWith(subB, expect.objectContaining({ tag: "say-reminder-j-b" }));
  });

  it("只推給同一位使用者的訂閱，不會推到別人的裝置", async () => {
    const otherUsersSub = { ...SUB, endpoint: "https://push.example/other", userId: "user-b" };
    const deps = makeDeps({ listSubscriptions: vi.fn(async () => [SUB, otherUsersSub]) });
    expect(await processReminders(deps)).toEqual({ due: 1, notified: 1, pushed: 1, pushFailed: 0, marked: 1 });
    expect(deps.sendPush).toHaveBeenCalledTimes(1);
    expect(deps.sendPush).toHaveBeenCalledWith(SUB, expect.anything());
  });

  it("提醒缺 userId：不推播任何訂閱並發警報，但仍建通知與寫 reminded_at", async () => {
    const { userId: _omit, ...withoutUser } = REMINDER;
    const deps = makeDeps({ fetchDue: vi.fn(async () => [withoutUser as DueReminder]) });
    expect(await processReminders(deps)).toEqual({ due: 1, notified: 1, pushed: 0, pushFailed: 0, marked: 1 });
    expect(deps.sendPush).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith("warn", expect.stringContaining("缺少使用者"), expect.anything());
  });
});

const SETTLE: DueReminder = {
  journalEntryId: "j-9",
  remindAt: "2026-10-14T13:25:00Z",
  experiencedAt: "2026-10-14T11:00:00Z",
  title: "散場了？",
  body: "《海街日記》剛結束。說一段，或打幾句。",
  url: "/say?journal=j-9",
  userId: "user-a",
  kind: "settle_prompt",
  push: true,
};

describe("散場當下提醒（settle_prompt）", () => {
  it("建通知＋推播（獨立 tag），不寫 reminded_at（不擋當天提醒與隔天「想說說嗎」）", async () => {
    const deps = makeDeps({ fetchDue: vi.fn(async () => [SETTLE]) });
    const result = await processReminders(deps);
    expect(result).toEqual({ due: 1, notified: 1, pushed: 1, pushFailed: 0, marked: 0 });
    expect(deps.createNotification).toHaveBeenCalledWith(SETTLE);
    expect(deps.markReminded).not.toHaveBeenCalled();
    expect(deps.sendPush).toHaveBeenCalledWith(SUB, {
      title: "散場了？",
      body: "《海街日記》剛結束。說一段，或打幾句。",
      url: "/say?journal=j-9",
      tag: "settle-prompt-j-9",
    });
  });

  it("同一條目只推一次：通知已存在就不再推", async () => {
    const deps = makeDeps({ fetchDue: vi.fn(async () => [SETTLE]), createNotification: vi.fn(async () => false) });
    expect(await processReminders(deps)).toMatchObject({ notified: 0, pushed: 0, marked: 0 });
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("深夜改隔天早上（push false）：只進收件匣，不推", async () => {
    const morning = { ...SETTLE, title: "昨晚的《海街日記》，還記得什麼嗎？", body: "說一段，或打幾句。", push: false };
    const deps = makeDeps({ fetchDue: vi.fn(async () => [morning]) });
    expect(await processReminders(deps)).toEqual({ due: 1, notified: 1, pushed: 0, pushFailed: 0, marked: 0 });
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("同一輪有散場提醒與「想說說嗎」：各推各的，不合併", async () => {
    const deps = makeDeps({ fetchDue: vi.fn(async () => [REMINDER, SETTLE]) });
    const result = await processReminders(deps);
    expect(result).toMatchObject({ notified: 2, pushed: 2, marked: 1 });
    const tags = vi.mocked(deps.sendPush!).mock.calls.map(([, payload]) => payload.tag);
    expect(tags).toEqual(["say-reminder-j-1", "settle-prompt-j-9"]);
  });

  it("推播未設定：只寫收件匣，warn 一次後不再重複（跨輪）", async () => {
    const deps = makeDeps({ fetchDue: vi.fn(async () => [SETTLE]), listSubscriptions: vi.fn(async () => []), sendPush: null });
    expect(await processReminders(deps)).toMatchObject({ notified: 1, pushed: 0 });
    await processReminders(deps);
    const warns = vi.mocked(deps.notify).mock.calls.filter(([level, title]) => level === "warn" && title.includes("推播未設定"));
    expect(warns).toHaveLength(1);
  });
});
