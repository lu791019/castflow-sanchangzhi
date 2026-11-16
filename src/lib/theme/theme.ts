/**
 * 放映廳（深色）切換規則（設計稿「P4 放映廳・切換規則」「P4 深色 Token」THEME 段）：
 * - preference：system（預設）｜light｜screen
 * - override：單集頁「關燈」鈕寫入的今晚覆寫；App 關閉或閒置 30 分鐘清除
 * - resolved = override ?? (preference = system ? 系統深淺 : preference)
 * - 分享頁只跟隨陌生人自己的系統
 */

export type ThemePreference = "system" | "light" | "screen";
export type ResolvedTheme = "light" | "screen";

export const PREFERENCE_KEY = "castflow.theme";
export const OVERRIDE_KEY = "castflow.theme-override";
export const OVERRIDE_IDLE_MS = 30 * 60 * 1000;

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "screen"];

export function parsePreference(raw: string | null | undefined): ThemePreference {
  return PREFERENCES.includes(raw as ThemePreference) ? (raw as ThemePreference) : "system";
}

export function isOverrideFresh(at: number, now: number): boolean {
  return now - at <= OVERRIDE_IDLE_MS;
}

/** sessionStorage 內容 `{ value, at }`；壞掉、過期一律當沒有覆寫 */
export function parseOverride(raw: string | null | undefined, now: number): ResolvedTheme | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { value?: unknown; at?: unknown };
    const value = parsed.value;
    if (value !== "light" && value !== "screen") return null;
    if (typeof parsed.at !== "number" || !isOverrideFresh(parsed.at, now)) return null;
    return value;
  } catch {
    return null;
  }
}

export interface ThemeInputs {
  preference: ThemePreference;
  override: ResolvedTheme | null;
  systemDark: boolean;
  sharePage?: boolean;
}

function fromPreference(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") return systemDark ? "screen" : "light";
  return preference;
}

export function resolveTheme({ preference, override, systemDark, sharePage = false }: ThemeInputs): ResolvedTheme {
  if (sharePage) return systemDark ? "screen" : "light";
  return override ?? fromPreference(preference, systemDark);
}

/** 按一下燈鈕後的覆寫值：翻轉目前結果；翻回與設定相同時清掉覆寫 */
export function lampToggle(inputs: ThemeInputs): ResolvedTheme | null {
  const base = fromPreference(inputs.preference, inputs.systemDark);
  const next: ResolvedTheme = resolveTheme(inputs) === "screen" ? "light" : "screen";
  return next === base ? null : next;
}

export function statusLine(preference: ThemePreference, systemDark: boolean): string {
  if (preference === "screen") return "固定為放映廳，不再跟隨系統。";
  if (preference === "light") return "固定為明亮，不再跟隨系統。";
  return systemDark ? "系統目前是深色，所以現在是放映廳。" : "系統目前是淺色，所以現在是明亮。";
}
