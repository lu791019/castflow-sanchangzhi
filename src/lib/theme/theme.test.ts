import { describe, expect, it } from "vitest";
import {
  OVERRIDE_IDLE_MS,
  isOverrideFresh,
  lampToggle,
  parseOverride,
  parsePreference,
  resolveTheme,
  statusLine,
} from "./theme";

describe("parsePreference", () => {
  it("只認三個值，其他一律跟隨系統", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("screen")).toBe("screen");
    expect(parsePreference("system")).toBe("system");
    expect(parsePreference("dark")).toBe("system");
    expect(parsePreference(null)).toBe("system");
  });
});

describe("parseOverride", () => {
  const now = 1_000_000_000;
  it("新鮮的覆寫可讀回", () => {
    expect(parseOverride(JSON.stringify({ value: "screen", at: now - 1000 }), now)).toBe("screen");
  });
  it("閒置超過 30 分鐘就失效", () => {
    expect(parseOverride(JSON.stringify({ value: "screen", at: now - OVERRIDE_IDLE_MS - 1 }), now)).toBeNull();
  });
  it("格式壞掉或值不對就當沒有", () => {
    expect(parseOverride("{oops", now)).toBeNull();
    expect(parseOverride(JSON.stringify({ value: "dark", at: now }), now)).toBeNull();
    expect(parseOverride(null, now)).toBeNull();
  });
});

describe("isOverrideFresh", () => {
  it("剛好 30 分鐘仍有效，多 1ms 就失效", () => {
    expect(isOverrideFresh(0, OVERRIDE_IDLE_MS)).toBe(true);
    expect(isOverrideFresh(0, OVERRIDE_IDLE_MS + 1)).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("跟隨系統：看 prefers-color-scheme", () => {
    expect(resolveTheme({ preference: "system", override: null, systemDark: true })).toBe("screen");
    expect(resolveTheme({ preference: "system", override: null, systemDark: false })).toBe("light");
  });
  it("固定值不跟系統變", () => {
    expect(resolveTheme({ preference: "light", override: null, systemDark: true })).toBe("light");
    expect(resolveTheme({ preference: "screen", override: null, systemDark: false })).toBe("screen");
  });
  it("覆寫優先", () => {
    expect(resolveTheme({ preference: "light", override: "screen", systemDark: false })).toBe("screen");
  });
  it("分享頁只跟隨系統，不帶作者設定與覆寫", () => {
    expect(resolveTheme({ preference: "screen", override: "screen", systemDark: false, sharePage: true })).toBe("light");
    expect(resolveTheme({ preference: "light", override: null, systemDark: true, sharePage: true })).toBe("screen");
  });
});

describe("lampToggle", () => {
  it("設定是明亮時按燈鈕＝今晚關燈", () => {
    expect(lampToggle({ preference: "light", override: null, systemDark: false })).toBe("screen");
  });
  it("覆寫成與設定相同就清掉覆寫", () => {
    expect(lampToggle({ preference: "light", override: "screen", systemDark: false })).toBeNull();
  });
  it("系統深色時按燈鈕＝今晚開燈", () => {
    expect(lampToggle({ preference: "system", override: null, systemDark: true })).toBe("light");
  });
});

describe("statusLine", () => {
  it("依設定與系統說明目前狀態", () => {
    expect(statusLine("system", true)).toBe("系統目前是深色，所以現在是放映廳。");
    expect(statusLine("system", false)).toBe("系統目前是淺色，所以現在是明亮。");
    expect(statusLine("screen", false)).toBe("固定為放映廳，不再跟隨系統。");
    expect(statusLine("light", true)).toBe("固定為明亮，不再跟隨系統。");
  });
});
