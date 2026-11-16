import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runIngest = vi.fn();
vi.mock("@/lib/events/repository", () => ({ createIngestStore: () => ({}) }));
vi.mock("@/lib/events/ingest", async (importOriginal) => ({ ...(await importOriginal<object>()), runIngest }));

const { POST } = await import("@/app/api/events/ingest/route");

function request(body: unknown, key?: string) {
  return new NextRequest("http://localhost/api/events/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "x-api-key": key } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/events/ingest", () => {
  beforeEach(() => {
    vi.stubEnv("API_SECRET_KEY", "test-key");
    runIngest.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("沒帶 key 或 key 錯 → 401，不寫入", async () => {
    expect((await POST(request({ source: "kktix", events: [] }))).status).toBe(401);
    expect((await POST(request({ source: "kktix", events: [] }, "wrong"))).status).toBe(401);
    expect(runIngest).not.toHaveBeenCalled();
  });

  it("內容不對 → 400", async () => {
    const response = await POST(request({ source: "tixcraft", events: [] }, "test-key"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "不認得的來源" });
  });

  it("正確 → 200 帶統計", async () => {
    runIngest.mockResolvedValue({ received: 0, upserted: 0, invalid: 0, merged: 0, pruned: 0 });
    const response = await POST(request({ source: "tfam", events: [] }, "test-key"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { received: 0, upserted: 0, invalid: 0, merged: 0, pruned: 0 } });
    expect(runIngest).toHaveBeenCalledWith({}, "tfam", [], expect.objectContaining({ invalid: 0 }));
  });

  it("寫入失敗 → 500 不外洩細節", async () => {
    runIngest.mockRejectedValue(new Error("db password=secret"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request({ source: "tfam", events: [] }, "test-key"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "寫入活動失敗" });
    spy.mockRestore();
  });
});
