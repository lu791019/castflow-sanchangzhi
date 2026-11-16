/**
 * 首屏前就決定主題，避免「先白再黑」閃一下。
 * 這段會被 toString() 塞進 <head> 的 inline script，所以必須自給自足：不可引用外部 import。
 * 規則與 theme.ts 的 resolveTheme 相同（測試兩邊對照）。
 */

export interface InitWindow {
  localStorage: Pick<Storage, "getItem">;
  sessionStorage: Pick<Storage, "getItem">;
  location: { pathname: string };
  matchMedia: (query: string) => { matches: boolean };
  document: { documentElement: { setAttribute: (name: string, value: string) => void } };
}

export function applyInitialTheme(win: InitWindow): void {
  let theme = "light";
  try {
    const systemDark = win.matchMedia("(prefers-color-scheme: dark)").matches;
    let resolved = systemDark ? "screen" : "light";
    if (win.location.pathname.indexOf("/s/") !== 0) {
      const pref = win.localStorage.getItem("castflow.theme");
      if (pref === "light" || pref === "screen") resolved = pref;
      const raw = win.sessionStorage.getItem("castflow.theme-override");
      if (raw) {
        const parsed = JSON.parse(raw);
        const fresh = typeof parsed.at === "number" && Date.now() - parsed.at <= 30 * 60 * 1000;
        if (fresh && (parsed.value === "light" || parsed.value === "screen")) resolved = parsed.value;
      }
    }
    theme = resolved;
  } catch {
    // 讀不到儲存（無痕等）就用明亮
  }
  win.document.documentElement.setAttribute("data-theme", theme);
}

export const THEME_INIT_SCRIPT = `(${applyInitialTheme.toString()})(window)`;
