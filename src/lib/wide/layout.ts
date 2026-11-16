/**
 * 寬螢幕版型（Q-60）純函式：散場之前「全部」依欄數決定放幾張、目錄海報架一列幾張、大標字級分級。
 * 不用 JS 量寬度（SSR 會閃）：每個寬度級距的欄數寫死在這裡，跟元件的 grid-cols 同步；
 * 超過該級距張數的卡用 CSS 藏起來（trimClass），所以伺服器一次 render 最多的那份就好。
 */

import { ALL_VIEW_LIMIT } from "@/lib/before/filter";

/** 寬版「全部」最多幾張 */
export const WIDE_ALL_VIEW_MAX = 18;

/** 寬度級距：base＝手機與平板（<1024）、lg＝1024–1279、xl＝1280–1439、wide＝≥1440 */
export const WIDE_TIERS = ["base", "lg", "xl", "wide"] as const;
export type WideTier = (typeof WIDE_TIERS)[number];
export type TierCounts = Readonly<Record<WideTier, number>>;

/** 散場之前主欄卡片欄數（ThisWeekCards 的 grid-cols；手機兩欄、平板三欄都算 base，張數照手機） */
export const BEFORE_GRID_COLUMNS: TierCounts = { base: 2, lg: 2, xl: 3, wide: 4 };

/** 目錄海報架一列幾張（只在寬版出現，base 不用） */
export const SHELF_COLUMNS: TierCounts = { base: 5, lg: 5, xl: 6, wide: 7 };

/** 「全部」放幾張：兩欄以下照手機；三欄以上每列排滿、不超過 18 張 */
export function allViewLimit(columns: number): number {
  if (columns <= 2) return ALL_VIEW_LIMIT;
  return Math.floor(WIDE_ALL_VIEW_MAX / columns) * columns;
}

/** 散場之前「全部」各級距張數：手機與平板不動 */
export function beforeAllLimits(columns: TierCounts = BEFORE_GRID_COLUMNS): TierCounts {
  return {
    base: ALL_VIEW_LIMIT,
    lg: allViewLimit(columns.lg),
    xl: allViewLimit(columns.xl),
    wide: allViewLimit(columns.wide),
  };
}

export function maxOf(counts: TierCounts): number {
  return Math.max(...WIDE_TIERS.map((tier) => counts[tier]));
}

/** 各級距「藏起來」的 class（字面寫死，Tailwind 才掃得到）；用 max-* 範圍變體，不跟元件本身的 display 打架 */
const HIDE_AT: Record<WideTier, string> = {
  base: "max-lg:hidden",
  lg: "lg:max-xl:hidden",
  xl: "xl:max-[90rem]:hidden",
  wide: "min-[90rem]:hidden",
};

/** 第 index 張（0 起）在超過張數的級距藏起來 */
export function trimClass(index: number, limits: TierCounts): string {
  return WIDE_TIERS.filter((tier) => index >= limits[tier])
    .map((tier) => HIDE_AT[tier])
    .join(" ");
}

export type HeadlineScale = "short" | "medium" | "long";

const SHORT_HEADLINE = 6;
const MEDIUM_HEADLINE = 14;

/** 跨頁大標、封面故事標題的字級分級：片名式短標題才用雛型的超大字，長標題縮小免得一行兩三字 */
export function headlineScale(title: string): HeadlineScale {
  const length = Array.from(title.trim()).length;
  if (length <= SHORT_HEADLINE) return "short";
  if (length <= MEDIUM_HEADLINE) return "medium";
  return "long";
}
