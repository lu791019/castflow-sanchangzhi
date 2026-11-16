"use client";

/**
 * 主題狀態：設定（localStorage）＋今晚覆寫（sessionStorage，閒置 30 分鐘失效）＋系統深淺。
 * 首屏的 data-theme 由 head inline script 先寫好；這裡負責之後的切換與「先暗底、後亮字」的過場。
 */

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  OVERRIDE_IDLE_MS,
  OVERRIDE_KEY,
  PREFERENCE_KEY,
  lampToggle,
  parseOverride,
  parsePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme/theme";

const SWITCH_MS = 360;
const TOUCH_THROTTLE_MS = 60_000;

interface ThemeContextValue {
  preference: ThemePreference;
  override: ResolvedTheme | null;
  resolved: ResolvedTheme;
  systemDark: boolean;
  setPreference: (next: ThemePreference) => void;
  toggleLamp: () => ResolvedTheme;
  clearOverride: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeSystem(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const systemSnapshot = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // 存不了就只在這次生效
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** 切換瞬間加一個 class：底 0–240ms、字 120–360ms；減少動態時 CSS 直接不過場 */
function applyTheme(theme: ResolvedTheme, animate: boolean): void {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") === theme) return;
  if (animate) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), SWITCH_MS);
  }
  root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const systemDark = useSyncExternalStore(subscribeSystem, systemSnapshot, () => false);
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [override, setOverride] = useState<ResolvedTheme | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreferenceState(parsePreference(safeGet(local, PREFERENCE_KEY)));
      setOverride(parseOverride(safeGet(session, OVERRIDE_KEY), Date.now()));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sharePage = pathname.startsWith("/s/");
  const resolved = resolveTheme({ preference, override, systemDark, sharePage });

  useEffect(() => {
    if (hydrated) applyTheme(resolved, true);
  }, [hydrated, resolved]);

  // 閒置計時：有操作就把覆寫的時間戳往後推；回到前景時檢查是否已過 30 分鐘
  useEffect(() => {
    if (!override) return;
    let last = 0;
    const touch = () => {
      const now = Date.now();
      if (now - last < TOUCH_THROTTLE_MS) return;
      last = now;
      safeSet(session, OVERRIDE_KEY, JSON.stringify({ value: override, at: now }));
    };
    const check = () => {
      if (document.visibilityState !== "visible") return;
      if (!parseOverride(safeGet(session, OVERRIDE_KEY), Date.now())) setOverride(null);
      else touch();
    };
    const idle = window.setInterval(check, OVERRIDE_IDLE_MS / 6);
    window.addEventListener("pointerdown", touch);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(idle);
      window.removeEventListener("pointerdown", touch);
      document.removeEventListener("visibilitychange", check);
    };
  }, [override]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setOverride(null);
    safeSet(local, PREFERENCE_KEY, next);
    safeSet(session, OVERRIDE_KEY, null);
  }, []);

  const toggleLamp = useCallback((): ResolvedTheme => {
    const next = lampToggle({ preference, override, systemDark });
    setOverride(next);
    safeSet(session, OVERRIDE_KEY, next ? JSON.stringify({ value: next, at: Date.now() }) : null);
    return resolveTheme({ preference, override: next, systemDark });
  }, [preference, override, systemDark]);

  const clearOverride = useCallback(() => {
    setOverride(null);
    safeSet(session, OVERRIDE_KEY, null);
  }, []);

  const value = useMemo(
    () => ({ preference, override, resolved, systemDark, setPreference, toggleLamp, clearOverride }),
    [preference, override, resolved, systemDark, setPreference, toggleLamp, clearOverride],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme 必須在 ThemeProvider 內使用");
  return value;
}
