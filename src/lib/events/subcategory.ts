/**
 * 散場之前「演出」的細分類（純函式）：演唱會／獨立音樂／戲劇／舞蹈／音樂祭各自取上限，不被演出總上限（16）擠掉。
 * 一般演出（performance）只在「全部」出現，不給小標籤；獨立音樂只有文化部類別 5 有。
 */

import { titleCategory } from "./collected";
import type { CultureEvent } from "./culture";
import { fairTake, type SourcedEvent } from "./select";

export const LIVE_SUBCATEGORIES = ["concert", "indie", "theatre", "dance", "festival"] as const;
export type LiveSubcategory = (typeof LIVE_SUBCATEGORIES)[number];

/** 每個細類最多幾張（手機兩欄六列） */
export const SUBCATEGORY_LIMIT = 12;

function isLiveSubcategory(value: unknown): value is LiveSubcategory {
  return typeof value === "string" && (LIVE_SUBCATEGORIES as readonly string[]).includes(value);
}

/** 演出的細類；一般演出、展覽、看不出來回 null。舊資料沒有 category 就看音樂祭標記與標題 */
export function liveSubcategoryOf(event: Pick<CultureEvent, "kind" | "category" | "festival" | "title">): LiveSubcategory | null {
  if (event.kind !== "live") return null;
  const category = event.category ?? (event.festival ? "festival" : titleCategory(event.title));
  return isLiveSubcategory(category) ? category : null;
}

/** 已照日期排好的演出 → 每個細類各取最多 12 張（每個出處先最多一半）；回傳仍照原順序 */
export function pickBySubcategory(sorted: readonly SourcedEvent[]): SourcedEvent[] {
  const chosen = new Set(
    LIVE_SUBCATEGORIES.flatMap((sub) =>
      fairTake(
        sorted.filter((event) => liveSubcategoryOf(event) === sub),
        SUBCATEGORY_LIMIT,
        SUBCATEGORY_LIMIT / 2,
      ),
    ),
  );
  return sorted.filter((event) => chosen.has(event));
}
