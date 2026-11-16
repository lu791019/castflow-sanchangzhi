import { describe, expect, it, vi } from "vitest";
import { loadCardFonts, loadGoogleFont, loadNeutralFonts, parseFontUrl } from "./og-fonts";

const CSS = `@font-face {
  font-family: 'Noto Serif TC';
  font-weight: 700;
  src: url(https://fonts.gstatic.com/l/font?kit=abc) format('truetype');
}`;

function fakeFetch(map: Record<string, Response | (() => Response)>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(map).find((prefix) => url.startsWith(prefix));
    if (!key) throw new Error(`unexpected ${url}`);
    const value = map[key];
    return typeof value === "function" ? value() : value;
  });
}

describe("parseFontUrl", () => {
  it("取出 truetype 網址；只有 woff2 時回 null", () => {
    expect(parseFontUrl(CSS)).toBe("https://fonts.gstatic.com/l/font?kit=abc");
    expect(parseFontUrl("src: url(https://x/y.woff2) format('woff2');")).toBeNull();
  });
});

describe("loadGoogleFont", () => {
  it("用 text= 只抓需要的字，回傳字型位元組", async () => {
    const fetchImpl = fakeFetch({
      "https://fonts.googleapis.com/": () => new Response(CSS),
      "https://fonts.gstatic.com/": () => new Response(new Uint8Array([1, 2, 3])),
    });
    const data = await loadGoogleFont("Noto Serif TC", 700, "散場", fetchImpl);
    expect(new Uint8Array(data)).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchImpl.mock.calls[0][0]).toContain(`text=${encodeURIComponent("散場")}`);
    expect(fetchImpl.mock.calls[0][0]).toContain("Noto%20Serif%20TC:wght@700");
  });

  it("CSS 非 200 或沒有 truetype 時丟錯（不靜默）", async () => {
    await expect(
      loadGoogleFont("Noto Sans TC", 400, "字", fakeFetch({ "https://fonts.googleapis.com/": new Response("", { status: 503 }) })),
    ).rejects.toThrow("503");
    await expect(
      loadGoogleFont("Noto Sans TC", 400, "字", fakeFetch({ "https://fonts.googleapis.com/": new Response("nothing") })),
    ).rejects.toThrow("truetype");
  });
});

describe("loadCardFonts", () => {
  it("四個字重；同一組字快取，不重抓", async () => {
    const fetchImpl = fakeFetch({
      "https://fonts.googleapis.com/": () => new Response(CSS),
      "https://fonts.gstatic.com/": () => new Response(new Uint8Array([9])),
    });
    const fonts = await loadCardFonts("快取測試", fetchImpl);
    expect(fonts.map((font) => `${font.name}:${font.weight}`)).toEqual([
      "Noto Serif TC:700",
      "Noto Serif TC:600",
      "Noto Sans TC:400",
      "Noto Sans TC:700",
    ]);
    await loadCardFonts("快取測試", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });

  it("失敗不進快取，下次會重試", async () => {
    let fail = true;
    const fetchImpl = fakeFetch({
      "https://fonts.googleapis.com/": () => (fail ? new Response("", { status: 500 }) : new Response(CSS)),
      "https://fonts.gstatic.com/": () => new Response(new Uint8Array([1])),
    });
    await expect(loadCardFonts("重試測試", fetchImpl)).rejects.toThrow();
    fail = false;
    await expect(loadCardFonts("重試測試", fetchImpl)).resolves.toHaveLength(4);
  });
});

describe("loadNeutralFonts", () => {
  it("讀本地子集字型（不連網）", async () => {
    const [font] = await loadNeutralFonts();
    expect(font.name).toBe("Noto Serif TC");
    expect(font.data.byteLength).toBeGreaterThan(1000);
  });
});
