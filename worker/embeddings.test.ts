import { describe, expect, it, vi } from "vitest";
import { refreshEmbeddings } from "./embeddings.ts";
import type { Notify } from "./notify.ts";

const fakeNotify = () => vi.fn<Notify>(async (level, title, detail) => ({ at: "t", level, title, detail: detail ?? "" }));

const result = (overrides = {}) => ({ scanned: 2, embedded: 2, skipped: 0, failed: 0, errors: [], ...overrides });

describe("worker refreshEmbeddings", () => {
  it("有算才記 log；全成功不推警報", async () => {
    const notify = fakeNotify();
    const log = vi.fn();
    await refreshEmbeddings({ refreshEmbeddings: async () => result() }, notify, log);
    expect(log).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("部分失敗 → 推 warn", async () => {
    const notify = fakeNotify();
    await refreshEmbeddings({ refreshEmbeddings: async () => result({ failed: 2, errors: ["Voyage 503"] }) }, notify, vi.fn());
    expect(notify).toHaveBeenCalledWith("warn", "詞向量補算部分失敗", "Voyage 503");
  });

  it("app API 呼叫失敗 → 推 warn 不擲錯", async () => {
    const notify = fakeNotify();
    await expect(
      refreshEmbeddings({ refreshEmbeddings: async () => Promise.reject(new Error("HTTP 500")) }, notify, vi.fn()),
    ).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith("warn", "詞向量補算失敗（app API 無法呼叫？）", "HTTP 500");
  });

  it("沒有要算的 → 安靜", async () => {
    const log = vi.fn();
    await refreshEmbeddings({ refreshEmbeddings: async () => result({ scanned: 0, embedded: 0 }) }, fakeNotify(), log);
    expect(log).not.toHaveBeenCalled();
  });
});
