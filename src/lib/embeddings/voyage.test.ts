import { describe, expect, it, vi } from "vitest";
import { createVoyageClient, VOYAGE_DIM, VOYAGE_MODEL, VOYAGE_URL, VoyageError } from "./voyage";

const KEY = "test-key-not-real";

function vector(seed: number): number[] {
  return Array.from({ length: VOYAGE_DIM }, (_, i) => (i === seed ? 1 : 0));
}

function ok(vectors: number[][]): Response {
  return new Response(
    JSON.stringify({ data: vectors.map((embedding, index) => ({ embedding, index })).reverse(), model: VOYAGE_MODEL }),
    { status: 200 },
  );
}

const noSleep = async () => undefined;

describe("createVoyageClient.embed", () => {
  it("POST voyage-3.5、帶 Bearer key 與 input_type，依 index 排回順序", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => ok([vector(0), vector(1)]));
    const client = createVoyageClient({ apiKey: KEY, fetchFn, sleep: noSleep });
    const result = await client.embed(["甲", "乙"], "document");
    expect(result).toEqual([vector(0), vector(1)]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(VOYAGE_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
    expect(JSON.parse(String(init?.body))).toEqual({ input: ["甲", "乙"], model: VOYAGE_MODEL, input_type: "document" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("429 → 重試一次成功", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(ok([vector(2)]));
    const client = createVoyageClient({ apiKey: KEY, fetchFn, sleep: noSleep });
    await expect(client.embed(["丙"], "query")).resolves.toEqual([vector(2)]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("5xx 連兩次 → 擲 VoyageError，只重試一次，訊息不帶 key", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ detail: "boom" }), { status: 503 }));
    const client = createVoyageClient({ apiKey: KEY, fetchFn, sleep: noSleep });
    const error = await client.embed(["丁"], "document").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(VoyageError);
    expect(String((error as Error).message)).toContain("503");
    expect(String((error as Error).message)).not.toContain(KEY);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("4xx（非 429）不重試", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response("{}", { status: 401 }));
    const client = createVoyageClient({ apiKey: KEY, fetchFn, sleep: noSleep });
    await expect(client.embed(["戊"], "document")).rejects.toThrow("401");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("回傳維度不對或筆數不符 → 擲錯", async () => {
    const short = vi.fn<typeof fetch>(async () => ok([[0.1, 0.2]]));
    await expect(createVoyageClient({ apiKey: KEY, fetchFn: short, sleep: noSleep }).embed(["己"], "document")).rejects.toThrow(
      "維度",
    );
    const missing = vi.fn<typeof fetch>(async () => ok([vector(0)]));
    await expect(
      createVoyageClient({ apiKey: KEY, fetchFn: missing, sleep: noSleep }).embed(["庚", "辛"], "document"),
    ).rejects.toThrow("筆數");
  });

  it("空陣列不打 API", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    await expect(createVoyageClient({ apiKey: KEY, fetchFn, sleep: noSleep }).embed([], "document")).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
