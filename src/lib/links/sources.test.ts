import { describe, expect, it } from "vitest";
import { sourceFromUrl } from "./sources";

describe("sourceFromUrl：網址 → 來源鍵與按鈕名", () => {
  it("白名單網域（含子網域）", () => {
    expect(sourceFromUrl("https://www.netflix.com/title/80057281")).toEqual({ source: "netflix", label: "Netflix", trusted: true });
    expect(sourceFromUrl("https://kktix.com/events/abc")).toEqual({ source: "kktix", label: "KKTIX", trusted: true });
    expect(sourceFromUrl("https://sunset.kktix.cc/events/x")).toMatchObject({ source: "kktix", trusted: true });
    expect(sourceFromUrl("https://tixcraft.com/activity/detail/26_x")).toMatchObject({ source: "tixcraft", label: "拓元" });
    expect(sourceFromUrl("https://www.opentix.life/event/1")).toMatchObject({ source: "opentix", label: "OPENTIX" });
    expect(sourceFromUrl("https://www.disneyplus.com/zh-hant/browse/x")).toMatchObject({ source: "disneyplus" });
  });

  it("網域只比對結尾整段，不被 evil-netflix.com 騙", () => {
    expect(sourceFromUrl("https://evil-netflix.com/x")).toMatchObject({ trusted: false, source: "web:evil-netflix.com" });
    expect(sourceFromUrl("https://netflix.com.evil.io/x")).toMatchObject({ trusted: false });
  });

  it("白名單外：來源用主機名、標示不受信任", () => {
    expect(sourceFromUrl("https://www.tfam.museum/Exhibition/x")).toEqual({
      source: "web:tfam.museum",
      label: "tfam.museum",
      trusted: false,
    });
  });

  it("不是 http(s) 或解析不了回 null", () => {
    expect(sourceFromUrl("javascript:alert(1)")).toBeNull();
    expect(sourceFromUrl("ftp://x.com")).toBeNull();
    expect(sourceFromUrl("not a url")).toBeNull();
  });
});
