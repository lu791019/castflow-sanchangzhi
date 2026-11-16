/**
 * 散場之前的出門類活動池（純函式）：文化部原始活動＋events 表 → 依縣市過濾 → 合併取上限，另給演出細類與縣市選項。
 * - 縣市在合併、截上限之前過濾：上限照舊（演出 16、展覽 10），但在該縣市內取；沒有縣市資料的只在「全部縣市」出現
 * - 沒選縣市時和原本一樣（文化部先取舊上限 12／8 再合併）
 * - 演出細類（演唱會／戲劇／舞蹈／音樂祭）各自取上限，不被 16 張總上限擠掉
 */

import { narrowToCity, rankCities } from "./city";
import { selectCultureEvents, selectInWindow, type CultureEvent } from "./culture";
import type { StoredEvent } from "./repository";
import { collapseByNormKey, mergeEventSources, mergeSorted, splitByKind, storedToCultureEvent, type SourcedEvent, type SourcedEvents } from "./select";
import { pickBySubcategory } from "./subcategory";

export interface EventPoolInput {
  /** 文化部解析過、還沒選場次的活動 */
  culture: readonly CultureEvent[];
  /** events 表 30 天窗內的列 */
  stored: readonly StoredEvent[];
  today: string;
  /** 選的縣市；null＝全部縣市 */
  city: string | null;
}

export interface EventPool {
  /** 演出 16、展覽 10（多來源合併規則照舊） */
  main: SourcedEvents;
  /** 演出細類各取最多 12 張（照日期），給小標籤用 */
  liveBySubcategory: SourcedEvent[];
  /** 30 天內有出門類活動的縣市，多的在前（不受目前選的縣市影響） */
  cities: string[];
}

export function buildEventPool({ culture, stored, today, city }: EventPoolInput): EventPool {
  const storedEvents = collapseByNormKey(stored).map(storedToCultureEvent);
  const cultureHere = narrowToCity(culture, city);
  const storedHere = splitByKind(selectInWindow(narrowToCity(storedEvents, city), today));
  const cultureLive = selectInWindow(cultureHere, today).filter((event) => event.kind === "live");
  return {
    main: mergeEventSources(selectCultureEvents(cultureHere, today), storedHere, today),
    liveBySubcategory: pickBySubcategory(mergeSorted(cultureLive, storedHere.live, today)),
    cities: rankCities([...culture, ...storedEvents], today),
  };
}
