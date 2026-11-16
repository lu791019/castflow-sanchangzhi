import { describe, expect, it, vi } from "vitest";
import type { Notify } from "../../../worker/notify";
import { CULTURE_API, CULTURE_RETRY_MS, CULTURE_TTL_MS, cultureConfigFromEnv, cultureUrl, createCultureLoader } from "./load";

const TODAY = "2026-10-14";

function show(uid: string, category: string, day = "2026/10/20") {
  return {
    UID: uid,
    title: `活動${uid}`,
    category,
    showInfo: [{ time: `${day} 19:30:00`, endTime: `${day} 21:00:00`, locationName: "場地", location: "" }],
    startDate: day,
    endDate: day,
    imageUrl: "",
    webSales: "",
    sourceWebPromote: "",
  };
}

/** 假警報器：記下呼叫；broken 時自己拋錯 */
function fakeNotify(broken = false) {
  return vi.fn<Notify>(async () => {
    if (broken) throw new Error("webhook down");
    return {} as Awaited<ReturnType<Notify>>;
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** 依 category 回固定資料；failing 裡的類別回 500 */
function fakeFetch(failing: readonly string[] = []) {
  return vi.fn(async (input: string | URL | Request) => {
    const category = new URL(String(input)).searchParams.get("category") ?? "";
    if (failing.includes(category)) return jsonResponse({ error: "boom" }, 500);
    return jsonResponse(category === "6" ? [show(`x${category}`, category)] : [show(`l${category}`, category)]);
  });
}

describe("cultureUrl／cultureConfigFromEnv", () => {
  it("組出 doFindTypeJ 網址", () => {
    expect(cultureUrl("6", CULTURE_API)).toBe(`${CULTURE_API}?method=doFindTypeJ&category=6`);
  });

  it("非 production 才吃 CULTURE_API_BASE／CULTURE_CACHE_TTL_MS", () => {
    const dev = cultureConfigFromEnv({ NODE_ENV: "development", CULTURE_API_BASE: "http://127.0.0.1:3166/culture", CULTURE_CACHE_TTL_MS: "0" });
    expect(dev).toEqual({ base: "http://127.0.0.1:3166/culture", ttlMs: 0 });
    const prod = cultureConfigFromEnv({ NODE_ENV: "production", CULTURE_API_BASE: "http://evil", CULTURE_CACHE_TTL_MS: "0" });
    expect(prod).toEqual({ base: CULTURE_API, ttlMs: 6 * 60 * 60_000 });
  });
});

describe("createCultureLoader", () => {
  it("loadAll：還沒選場次的全部活動（窗外的也在、帶細類），失敗的類別一樣推警報", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const category = new URL(String(input)).searchParams.get("category") ?? "";
      if (category === "3") return jsonResponse({ error: "boom" }, 500);
      return jsonResponse(category === "2" ? [show("far", "2", "2027/03/01")] : []);
    });
    const notify = fakeNotify();
    const loader = createCultureLoader({ fetch, base: CULTURE_API, ttlMs: 1000, notify });
    const all = await loader.loadAll();
    expect(all.map((event) => [event.uid, event.category])).toEqual([["far", "theatre"]]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect((await loader.load(TODAY)).live).toEqual([]);
  });

  it("六個類別都抓、合併成演出與展覽", async () => {
    const fetch = fakeFetch();
    const notify = fakeNotify();
    const loader = createCultureLoader({ fetch, base: CULTURE_API, ttlMs: 1000, notify });
    const result = await loader.load(TODAY);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(result.live.map((event) => event.uid).sort()).toEqual(["l1", "l17", "l2", "l3", "l5"]);
    expect(result.exhibition.map((event) => event.uid)).toEqual(["x6"]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("TTL 內不重抓；過期才重抓", async () => {
    let clock = 0;
    const fetch = fakeFetch();
    const loader = createCultureLoader({ fetch, base: CULTURE_API, ttlMs: 1000, notify: fakeNotify(), now: () => clock });
    await loader.load(TODAY);
    clock = 500;
    await loader.load(TODAY);
    expect(fetch).toHaveBeenCalledTimes(6);
    clock = 1500;
    await loader.load(TODAY);
    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it("部分類別失敗：其他照用、推 warn；失敗的 10 分鐘內不重打也不重複警報", async () => {
    let clock = 0;
    const fetch = fakeFetch(["6", "17"]);
    const notify = fakeNotify();
    const loader = createCultureLoader({ fetch, base: CULTURE_API, ttlMs: CULTURE_TTL_MS, notify, now: () => clock });
    const result = await loader.load(TODAY);
    expect(result.exhibition).toEqual([]);
    expect(result.live).toHaveLength(4);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toBe("warn");
    expect(String(notify.mock.calls[0][2])).toContain("category=6");
    clock = CULTURE_RETRY_MS - 1;
    await loader.load(TODAY);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(notify).toHaveBeenCalledTimes(1);
    // 過了 10 分鐘：成功的 4 類仍走快取，失敗的 2 類重抓（又失敗就再警報一次）
    clock = CULTURE_RETRY_MS;
    await loader.load(TODAY);
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("全掛（逾時、壞 JSON）：回空、不拋錯", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const notify = fakeNotify();
    const loader = createCultureLoader({ fetch, base: CULTURE_API, ttlMs: 1000, notify });
    await expect(loader.load(TODAY)).resolves.toEqual({ live: [], exhibition: [] });
    expect(notify).toHaveBeenCalledTimes(1);

    const broken = vi.fn(async () => new Response("<html>", { status: 200 }));
    const again = createCultureLoader({ fetch: broken, base: CULTURE_API, ttlMs: 1000, notify });
    await expect(again.load(TODAY)).resolves.toEqual({ live: [], exhibition: [] });
  });

  it("警報器自己壞了也不擋頁面", async () => {
    const notify = fakeNotify(true);
    const loader = createCultureLoader({ fetch: fakeFetch(["1"]), base: CULTURE_API, ttlMs: 1000, notify });
    await expect(loader.load(TODAY)).resolves.toMatchObject({ exhibition: [{ uid: "x6" }] });
  });
});
