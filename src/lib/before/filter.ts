/** 散場之前①的分類切換（純函式）：全部只放排好的前幾張；選了類別就看那一類全部 */

import { cardMedia, type BeforeCard, type CardMedia } from "./cards";

export type BeforeFilter = "all" | CardMedia;

export const BEFORE_FILTERS: ReadonlyArray<{ value: BeforeFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "movie", label: "電影" },
  { value: "series", label: "影集" },
  { value: "podcast", label: "Podcast" },
  { value: "music", label: "音樂" },
  { value: "live", label: "演出" },
  { value: "exhibition", label: "展覽" },
];

/** 「全部」最多幾張（手機兩欄六列；其餘點類別看） */
export const ALL_VIEW_LIMIT = 12;

/** allLimit：「全部」取幾張；寬版（Q-60）先多取，超過該寬度張數的用 CSS 藏 */
export function filterCards(cards: readonly BeforeCard[], filter: BeforeFilter, allLimit: number = ALL_VIEW_LIMIT): BeforeCard[] {
  if (filter === "all") return cards.slice(0, allLimit);
  return cards.filter((card) => cardMedia(card) === filter);
}

/** 有卡的類別才給切（來源掛掉只少那一類）；「全部」一定在 */
export function availableFilters(cards: readonly BeforeCard[]): BeforeFilter[] {
  const present = new Set(cards.map(cardMedia));
  return BEFORE_FILTERS.flatMap(({ value }) => (value === "all" || present.has(value) ? [value] : []));
}
