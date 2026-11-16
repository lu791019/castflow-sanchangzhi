import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin", () => ({ isSiteOwner: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { isSiteOwner } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadThreadsDirectConfig, parseThreadsDirectConfig } from "./threads-direct";

function mockSettings(value: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq"]) builder[method] = () => builder;
  builder.maybeSingle = async () => ({ data: value === undefined ? null : { value }, error: null });
  vi.mocked(createAdminClient).mockReturnValue(builder as unknown as ReturnType<typeof createAdminClient>);
}

describe("parseThreadsDirectConfig", () => {
  it.each([[null], [{}], [{ user_id: "", access_token: "t" }], [{ user_id: 1, access_token: "t" }]])("不完整 → null %#", (value) => {
    expect(parseThreadsDirectConfig(value)).toBeNull();
  });

  it("完整才回設定", () => {
    expect(parseThreadsDirectConfig({ user_id: "u", access_token: "t" })).toEqual({ userId: "u", accessToken: "t" });
  });
});

describe("loadThreadsDirectConfig", () => {
  beforeEach(() => vi.clearAllMocks());

  it("不是站長：不讀設定、回 null", async () => {
    vi.mocked(isSiteOwner).mockResolvedValue(false);
    await expect(loadThreadsDirectConfig("someone")).resolves.toBeNull();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("站長但沒設定 → null；有設定 → 設定", async () => {
    vi.mocked(isSiteOwner).mockResolvedValue(true);
    mockSettings(undefined);
    await expect(loadThreadsDirectConfig("dex")).resolves.toBeNull();
    mockSettings({ user_id: "u", access_token: "t" });
    await expect(loadThreadsDirectConfig("dex")).resolves.toEqual({ userId: "u", accessToken: "t" });
  });
});
