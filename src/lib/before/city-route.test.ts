import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
const saveBeforeCity = vi.fn();
const loadBeforeView = vi.fn();
vi.mock("@/lib/auth/api", () => ({ requireApiUser }));
vi.mock("@/lib/before/city-repository", () => ({ saveBeforeCity }));
vi.mock("@/lib/before/load", () => ({
  loadBeforeView,
  thisWeekOf: ({ cards, hasLive, hasCulture, eventSources, liveSub, cityFilter }: Record<string, unknown>) => ({ cards, hasLive, hasCulture, eventSources, liveSub, cityFilter }),
}));

const THIS_WEEK = { cards: [], hasLive: true, hasCulture: false, eventSources: [], liveSub: [], cityFilter: { city: "臺南市", cities: ["臺南市"] } };

const { POST } = await import("@/app/api/before/city/route");

function request(body: unknown) {
  return new NextRequest("http://localhost/api/before/city", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/before/city", () => {
  beforeEach(() => {
    requireApiUser.mockReset().mockResolvedValue({ ok: true, userId: "u1" });
    saveBeforeCity.mockReset().mockResolvedValue(undefined);
    loadBeforeView.mockReset().mockResolvedValue({ ...THIS_WEEK, upcoming: [], said: [] });
  });

  it("未登入 → 401，不寫入", async () => {
    requireApiUser.mockResolvedValue({ ok: false, response: NextResponse.json({ success: false, error: "請先登入" }, { status: 401 }) });
    expect((await POST(request({ city: "臺北市" }))).status).toBe(401);
    expect(saveBeforeCity).not.toHaveBeenCalled();
  });

  it("不在 22 縣市白名單 → 400，不寫入", async () => {
    for (const body of [{ city: "台北" }, { city: "東京都" }, {}, "臺北市"]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(saveBeforeCity).not.toHaveBeenCalled();
  });

  it("存本人那一列；台 → 臺；null＝全部縣市", async () => {
    const response = await POST(request({ city: "台南市" }));
    expect(response.status).toBe(200);
    // 回依新縣市重算的①（畫面直接換，不等 router.refresh）；不帶①以外的區塊
    expect(await response.json()).toEqual({ success: true, city: "臺南市", thisWeek: THIS_WEEK });
    expect(loadBeforeView).toHaveBeenCalledWith("u1", expect.any(Date));
    expect(saveBeforeCity).toHaveBeenCalledWith("u1", "臺南市", expect.any(Date));
    expect((await POST(request({ city: null }))).status).toBe(200);
    expect(saveBeforeCity).toHaveBeenLastCalledWith("u1", null, expect.any(Date));
  });

  it("存好但①重算失敗 → 仍 200，thisWeek 為 null（畫面靠 refresh 跟上）", async () => {
    loadBeforeView.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request({ city: "臺北市" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, city: "臺北市", thisWeek: null });
    spy.mockRestore();
  });

  it("寫入失敗 → 500 不外洩細節", async () => {
    saveBeforeCity.mockRejectedValue(new Error("db password=secret"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request({ city: "臺北市" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "沒存到，稍後再試" });
    spy.mockRestore();
  });
});
