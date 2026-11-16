/**
 * 品味問卷⑤「演出想看哪種」（純函式，Q-63）：沿用散場之前演出細分類 key（events/subcategory.ts）。
 * 存在既有 settings 表（每人一列，key = taste_live:<userId>，同 taste_picks:<userId> 的寫法），不加 migration；
 * 值 { kinds: ["concert", …] }。散場之前排序時，選了的細類排在其他演出前面（before/cards.ts）。
 */

import { SUB_FILTER_LABELS } from "@/lib/before/live-filter";
import { LIVE_SUBCATEGORIES, type LiveSubcategory } from "@/lib/events/subcategory";

export const TASTE_LIVE_KEY = "taste_live";

export const LIVE_KIND_LABELS = Object.fromEntries(LIVE_SUBCATEGORIES.map((kind) => [kind, SUB_FILTER_LABELS[kind]])) as Record<
  LiveSubcategory,
  string
>;

export function tasteLiveKey(userId: string): string {
  return `${TASTE_LIVE_KEY}:${userId}`;
}

export function isLiveKind(value: unknown): value is LiveSubcategory {
  return typeof value === "string" && (LIVE_SUBCATEGORIES as readonly string[]).includes(value);
}

/** 白名單內的細類，去重、照固定順序 */
export function orderLiveKinds(kinds: readonly LiveSubcategory[]): LiveSubcategory[] {
  return LIVE_SUBCATEGORIES.filter((kind) => kinds.includes(kind));
}

/** settings.value → 細類；壞資料當沒答 */
export function parseStoredLiveKinds(value: unknown): LiveSubcategory[] {
  const kinds = (value as { kinds?: unknown } | null)?.kinds;
  return Array.isArray(kinds) ? orderLiveKinds(kinds.filter(isLiveKind)) : [];
}

/** 複選：點一下加入／移除，順序固定照 LIVE_SUBCATEGORIES */
export function toggleLiveKind(selected: readonly LiveSubcategory[], kind: LiveSubcategory): LiveSubcategory[] {
  return orderLiveKinds(selected.includes(kind) ? selected.filter((item) => item !== kind) : [...selected, kind]);
}
