import { describe, expect, it } from "vitest";
import { BEFORE_PATH, FEED_PATH, NAV_ITEMS, activeFromPathname, wideActiveFromPathname, wideNavItems } from "./nav-routes";

describe("導覽四格（散場之前／目錄／日誌／我的）", () => {
  it("順序與連結", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(["散場之前", "目錄", "日誌", "我的"]);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([BEFORE_PATH, FEED_PATH, "/journal", "/me"]);
    expect(BEFORE_PATH).toBe("/before");
  });

  it("/before 選中「散場之前」", () => {
    expect(activeFromPathname("/before")).toBe("before");
    expect(activeFromPathname("/beforehand")).toBeNull();
  });

  it("索引、作者專欄、作品頁歸「目錄」（作品格已拿掉）", () => {
    expect(activeFromPathname("/")).toBe("home");
    expect(activeFromPathname("/catalog")).toBe("home");
    expect(activeFromPathname("/authors/%E6%9E%97")).toBe("home");
    expect(activeFromPathname("/works")).toBe("home");
    expect(activeFromPathname("/works/abc")).toBe("home");
    expect(activeFromPathname("/catalogue")).toBeNull();
  });

  it("日誌與我的", () => {
    expect(activeFromPathname("/journal")).toBe("journal");
    expect(activeFromPathname("/journal/new")).toBe("journal");
    expect(activeFromPathname("/me")).toBe("me");
  });
});

describe("平板直欄／桌機刊頭", () => {
  it("四格中間多「索引」；社群關閉時連回作品列表", () => {
    expect(wideNavItems(true).map((item) => item.label)).toEqual(["散場之前", "目錄", "索引", "日誌", "我的"]);
    expect(wideNavItems(true).find((item) => item.label === "索引")?.href).toBe("/catalog");
    expect(wideNavItems(false).find((item) => item.label === "索引")?.href).toBe("/works");
  });
  it("索引、作者專欄、作品頁選中「索引」，其他照舊", () => {
    expect(wideActiveFromPathname("/catalog")).toBe("index");
    expect(wideActiveFromPathname("/authors/x")).toBe("index");
    expect(wideActiveFromPathname("/works/abc")).toBe("index");
    expect(wideActiveFromPathname("/before")).toBe("before");
    expect(wideActiveFromPathname("/")).toBe("home");
  });
});
