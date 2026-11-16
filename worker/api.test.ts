import { describe, expect, it, vi } from "vitest";
import { createAppApi } from "./api.ts";

function okFetch() {
  return vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify({ success: true }), { status: 200 }),
  );
}

describe("createAppApi.transcribeFallback", () => {
  it("沒有本機音檔 → JSON 只送 episodeId，由 app 自行下載", async () => {
    const fetchFn = okFetch();
    const api = createAppApi("http://app", "key", fetchFn);
    await api.transcribeFallback("ep-1", null);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://app/api/transcribe");
    expect(init?.headers).toMatchObject({
      "x-api-key": "key",
      "Content-Type": "application/json",
    });
    expect(init?.body).toBe(JSON.stringify({ episodeId: "ep-1" }));
  });

  it("有本機音檔 → multipart 帶 episodeId + audio 檔", async () => {
    const fetchFn = okFetch();
    const api = createAppApi("http://app", "key", fetchFn);
    await api.transcribeFallback("ep-1", {
      data: new Uint8Array([1, 2, 3]),
      fileName: "clip.mp3",
    });

    const [, init] = fetchFn.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("key");
    // multipart boundary 由 fetch 自動產生，不可手動設 Content-Type
    expect(headers["Content-Type"]).toBeUndefined();
    const form = init?.body as FormData;
    expect(form.get("episodeId")).toBe("ep-1");
    const audio = form.get("audio") as File;
    expect(audio.name).toBe("clip.mp3");
    expect(audio.size).toBe(3);
  });

  it("非 2xx → 拋出含 app 錯誤訊息的例外", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Audio file too large" }), { status: 500 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.transcribeFallback("ep-1", null)).rejects.toThrow(
      "/api/transcribe 失敗：Audio file too large",
    );
  });
});

describe("createAppApi.understand", () => {
  it("POST /api/episodes/:id/reading 並回傳 app 端狀態", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ success: true, status: "skipped" }), { status: 200 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.understand("ep-1")).resolves.toEqual({ status: "skipped" });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://app/api/episodes/ep-1/reading");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "x-api-key": "key" });
  });

  it("非 2xx → 拋出含錯誤訊息的例外（交給 pipeline 推警報）", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ error: "翻譯第 1/2 批 失敗" }), { status: 500 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.understand("ep-1")).rejects.toThrow("翻譯第 1/2 批 失敗");
  });
});

describe("createAppApi.fetchDueReminders", () => {
  it("GET /api/journal/due 帶 x-api-key，回傳 reminders", async () => {
    const reminders = [
      { journalEntryId: "j", remindAt: "t", title: "昨晚的《海街日記》", body: "b", url: "/say?journal=j" },
    ];
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ reminders }), { status: 200 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.fetchDueReminders()).resolves.toEqual(reminders);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://app/api/journal/due");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toMatchObject({ "x-api-key": "key" });
  });

  it("回應缺 reminders 陣列 → 擲錯", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.fetchDueReminders()).rejects.toThrow("reminders");
  });

  it("401 → 擲錯", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.fetchDueReminders()).rejects.toThrow("Unauthorized");
  });
});

describe("createAppApi.refreshWatch", () => {
  it("POST /api/works/watch/refresh 帶 x-api-key，回傳更新結果", async () => {
    const data = { scanned: 2, updated: 1, failed: 1, errors: ["w1：TMDB 503"] };
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ success: true, data }), { status: 200 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.refreshWatch()).resolves.toEqual(data);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://app/api/works/watch/refresh");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "x-api-key": "key" });
  });

  it("回應格式不對 → 擲錯", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.refreshWatch()).rejects.toThrow("在哪看");
  });
});

describe("createAppApi.refreshCovers", () => {
  it("POST /api/works/covers/refresh 帶 x-api-key，回傳補圖結果", async () => {
    const data = { scanned: 3, filled: 2, missing: 1, failed: 0, errors: [] };
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ success: true, data }), { status: 200 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.refreshCovers()).resolves.toEqual(data);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://app/api/works/covers/refresh");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "x-api-key": "key" });
  });

  it("回應格式不對 → 擲錯", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { scanned: 1 } }), { status: 200 }));
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.refreshCovers()).rejects.toThrow("補封面");
  });
});

describe("createAppApi.refreshEmbeddings", () => {
  it("POST /api/episodes/embeddings/refresh 帶 x-api-key，回傳補算結果", async () => {
    const data = { scanned: 2, embedded: 0, skipped: 2, failed: 0, errors: [] };
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ success: true, data }), { status: 200 }),
    );
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.refreshEmbeddings()).resolves.toEqual(data);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://app/api/episodes/embeddings/refresh");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "x-api-key": "key" });
  });

  it("回應格式不對 → 擲錯", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { scanned: 1 } }), { status: 200 }));
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.refreshEmbeddings()).rejects.toThrow("詞向量");
  });
});

describe("createAppApi.ingestEvents", () => {
  it("POST 一個來源的活動、帶 x-api-key，回傳統計", async () => {
    const data = { received: 1, upserted: 1, invalid: 0, merged: 0, pruned: 0 };
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: true, data }), { status: 200 }));
    const api = createAppApi("http://app", "key", fetchFn);
    await expect(api.ingestEvents("tfam", [])).resolves.toEqual(data);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://app/api/events/ingest");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "x-api-key": "key" });
    expect(init?.body).toBe(JSON.stringify({ source: "tfam", events: [] }));
  });

  it("401 或格式不對 → 丟錯", async () => {
    const unauthorized = createAppApi("http://app", "bad", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })));
    await expect(unauthorized.ingestEvents("tfam", [])).rejects.toThrow("Unauthorized");
    const malformed = createAppApi("http://app", "key", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
    await expect(malformed.ingestEvents("tfam", [])).rejects.toThrow("藝文活動");
  });
});
