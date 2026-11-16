/**
 * 散場之前①演出細分類＋縣市篩選（純函式，client 也用）：
 * - 演出分頁下的小標籤：全部／演唱會／戲劇／舞蹈／音樂祭（只列有資料的；一般演出只在「全部」）
 * - 小標籤從細類池子取（每類最多 12 張，不被演出 16 張總上限擠掉）
 * - 縣市選單在「全部」與演出、展覽分頁（全部裡的演出、展覽卡也被篩）；電影、影集、Podcast、音樂不顯示
 * - 選了縣市：演出、展覽分頁一定在，沒場次時一句話（不讓整區消失）
 */

import { LIVE_SUBCATEGORIES, SUBCATEGORY_LIMIT, type LiveSubcategory } from "@/lib/events/subcategory";
import type { BeforeCard } from "./cards";
import { availableFilters, BEFORE_FILTERS, filterCards, type BeforeFilter } from "./filter";

export type SubFilter = "all" | LiveSubcategory;

export const SUB_FILTER_LABELS: Record<SubFilter, string> = {
  all: "全部",
  concert: "演唱會",
  indie: "獨立音樂",
  theatre: "戲劇",
  dance: "舞蹈",
  festival: "音樂祭",
};

/** 縣市篩選：目前選的（null＝全部縣市）＋30 天內有出門類活動的縣市（多的在前） */
export interface CityFilter {
  city: string | null;
  cities: string[];
}

/** 出門類：選縣市只影響這兩類 */
export type OutingMedia = "live" | "exhibition";

export function isOutingMedia(filter: BeforeFilter): filter is OutingMedia {
  return filter === "live" || filter === "exhibition";
}

/** 縣市選單顯示在哪些分頁 */
export function showsCityFilter(filter: BeforeFilter): boolean {
  return filter === "all" || isOutingMedia(filter);
}

/** 有任何細類才出小標籤（含「全部」）；照固定順序 */
export function availableSubFilters(pool: readonly BeforeCard[]): SubFilter[] {
  const present = new Set(pool.flatMap((card) => (card.subcategory ? [card.subcategory] : [])));
  const subs = LIVE_SUBCATEGORIES.filter((sub) => present.has(sub));
  return subs.length > 0 ? ["all", ...subs] : [];
}

export function subFilterCards(pool: readonly BeforeCard[], sub: LiveSubcategory): BeforeCard[] {
  return pool.filter((card) => card.subcategory === sub).slice(0, SUBCATEGORY_LIMIT);
}

/** 分頁＋小標籤 → 要顯示的卡；小標籤只在演出分頁有作用 */
export function visibleCards(
  cards: readonly BeforeCard[],
  liveSub: readonly BeforeCard[],
  filter: BeforeFilter,
  sub: SubFilter,
  allLimit?: number,
): BeforeCard[] {
  if (filter === "live" && sub !== "all") return subFilterCards(liveSub, sub);
  return filterCards(cards, filter, allLimit);
}

/** 選了縣市時演出、展覽分頁一定在（才看得到空狀態、才換得回來） */
export function filterTabs(cards: readonly BeforeCard[], city: string | null): BeforeFilter[] {
  const present = availableFilters(cards);
  if (!city) return present;
  return BEFORE_FILTERS.flatMap(({ value }) => (present.includes(value) || isOutingMedia(value) ? [value] : []));
}

/** 下拉選項：有活動的縣市（多的在前）；目前選的若已沒活動也留著，放最前面 */
export function cityChoices(cities: readonly string[], selected: string | null): string[] {
  return selected && !cities.includes(selected) ? [selected, ...cities] : [...cities];
}

export function liveEmptyCopy(city: string, media: OutingMedia, sub: SubFilter = "all"): string {
  const label = sub !== "all" ? SUB_FILTER_LABELS[sub] : media === "live" ? "演出" : "展覽";
  return `這 30 天${city}沒有${label}，換個縣市看看`;
}
