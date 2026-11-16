import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

import {
  getCurrentUserId,
  isUnauthorizedError,
  requireUserId,
  UnauthorizedError,
  userIdFrom,
} from "./session";

beforeEach(() => {
  getUser.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("userIdFrom", () => {
  it("有使用者回 uid", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    expect(await userIdFrom({ auth: { getUser } })).toBe("u-1");
  });

  it("沒有 session 回 null（不是錯誤）", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });
    expect(await userIdFrom({ auth: { getUser } })).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("其他驗證錯誤回 null 並記 log", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", message: "boom" } });
    expect(await userIdFrom({ auth: { getUser } })).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("連線抖動（AuthRetryableFetchError）重試一次，成功就不當成登出（UX-16）", async () => {
    getUser
      .mockResolvedValueOnce({ data: { user: null }, error: { name: "AuthRetryableFetchError", message: "fetch failed" } })
      .mockResolvedValueOnce({ data: { user: { id: "u-3" } }, error: null });
    expect(await userIdFrom({ auth: { getUser } })).toBe("u-3");
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("重試仍失敗才回 null 並記 log", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", message: "fetch failed" } });
    expect(await userIdFrom({ auth: { getUser } })).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalled();
  });

  it("getUser 拋出時回 null 並記 log", async () => {
    getUser.mockRejectedValue(new Error("network"));
    expect(await userIdFrom({ auth: { getUser } })).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("getCurrentUserId / requireUserId", () => {
  it("登入時兩者都回 uid", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-2" } }, error: null });
    expect(await getCurrentUserId()).toBe("u-2");
    expect(await requireUserId()).toBe("u-2");
  });

  it("未登入時 requireUserId 丟可辨識的 UnauthorizedError", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentUserId()).toBeNull();
    const error = await requireUserId().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(isUnauthorizedError(error)).toBe(true);
    expect((error as UnauthorizedError).message).toBe("請先登入");
  });

  it("isUnauthorizedError 不誤判一般錯誤", () => {
    expect(isUnauthorizedError(new Error("x"))).toBe(false);
    expect(isUnauthorizedError(null)).toBe(false);
  });
});
