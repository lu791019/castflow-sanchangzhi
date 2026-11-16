import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, applyInitialTheme, type InitWindow } from "./init-script";

function fakeWindow(opts: {
  pref?: string;
  override?: string;
  path?: string;
  dark?: boolean;
}): { win: InitWindow; theme: () => string | undefined } {
  let theme: string | undefined;
  const win: InitWindow = {
    localStorage: { getItem: (k) => (k === "castflow.theme" ? (opts.pref ?? null) : null) },
    sessionStorage: { getItem: (k) => (k === "castflow.theme-override" ? (opts.override ?? null) : null) },
    location: { pathname: opts.path ?? "/" },
    matchMedia: () => ({ matches: Boolean(opts.dark) }),
    document: { documentElement: { setAttribute: (_n, v) => (theme = v) } },
  };
  return { win, theme: () => theme };
}

describe("applyInitialTheme", () => {
  it("預設跟隨系統", () => {
    const f = fakeWindow({ dark: true });
    applyInitialTheme(f.win);
    expect(f.theme()).toBe("screen");
  });
  it("設定固定明亮時不理系統", () => {
    const f = fakeWindow({ dark: true, pref: "light" });
    applyInitialTheme(f.win);
    expect(f.theme()).toBe("light");
  });
  it("新鮮的覆寫優先", () => {
    const f = fakeWindow({ pref: "light", override: JSON.stringify({ value: "screen", at: Date.now() }) });
    applyInitialTheme(f.win);
    expect(f.theme()).toBe("screen");
  });
  it("過期覆寫忽略", () => {
    const f = fakeWindow({ pref: "light", override: JSON.stringify({ value: "screen", at: Date.now() - 31 * 60 * 1000 }) });
    applyInitialTheme(f.win);
    expect(f.theme()).toBe("light");
  });
  it("分享頁只看系統", () => {
    const f = fakeWindow({ path: "/s/abc", pref: "screen", dark: false });
    applyInitialTheme(f.win);
    expect(f.theme()).toBe("light");
  });
  it("儲存讀取爆掉時回明亮", () => {
    const f = fakeWindow({ override: "{bad" , dark: true});
    applyInitialTheme(f.win);
    expect(f.theme()).toBe("light");
  });
  it("輸出的 script 字串可獨立執行", () => {
    const f = fakeWindow({ dark: true });
    new Function("window", THEME_INIT_SCRIPT)(f.win);
    expect(f.theme()).toBe("screen");
  });
});
