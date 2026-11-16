/** 品味資料的領域型別與列舉（DB check 約束與此同步，見 migration 028、040） */

import type { LiveSubcategory } from "@/lib/events/subcategory";
import type { Venue } from "@/lib/journal/types";
import type { WorkKind } from "@/lib/works/format";

export const MEDIA_KEYS = ["movie", "series", "podcast", "music", "live", "exhibition"] as const;
export type MediaKey = (typeof MEDIA_KEYS)[number];

export const MEDIA_LABELS: Record<MediaKey, string> = {
  movie: "電影",
  series: "影集",
  podcast: "Podcast",
  music: "音樂",
  live: "演出",
  exhibition: "展覽",
};

export const TASTE_SETTINGS = ["home", "out", "both"] as const;
export type TasteSetting = (typeof TASTE_SETTINGS)[number];

export const SETTING_LABELS: Record<TasteSetting, string> = {
  home: "在家",
  out: "出門",
  both: "都有",
};

export interface Questionnaire {
  media: MediaKey[];
  setting: TasteSetting | null;
}

/** 行為足跡：一筆日誌（手寫片名的沒有作品，kind 為 null） */
export interface TasteJournal {
  workId: string | null;
  kind: WorkKind | null;
  venue: Venue;
}

export interface TastePublishedWork {
  workId: string;
  kind: WorkKind;
}

export interface TasteMark {
  episodeId: string;
  passageHash: string;
}

/** 問卷第三題挑的作品（存在 settings，不寫日誌；見 picks.ts） */
export interface TastePickedWork {
  workId: string;
  kind: WorkKind;
  seen: boolean;
}

export interface TasteInputs {
  journals: readonly TasteJournal[];
  publishedWorks: readonly TastePublishedWork[];
  marks: readonly TasteMark[];
  questionnaire: Questionnaire | null;
  /** 沒傳＝沒挑 */
  picks?: readonly TastePickedWork[];
  /** 問卷⑤演出想看哪種（Q-63，存在 settings）；沒傳＝沒答 */
  liveKinds?: readonly LiveSubcategory[];
}

export interface TasteProfile {
  /** 媒介分佈：加總為 1（沒有訊號時全 0） */
  media: Record<MediaKey, number>;
  /** 場域分佈：在家／出門，加總為 1（沒有訊號時全 0） */
  setting: { home: number; out: number };
  works: string[];
  /** 畫記句：`episodeId:passageHash` */
  passages: string[];
  behaviorCount: number;
  usedQuestionnaire: boolean;
  hasSignal: boolean;
  /** 問卷⑤演出想看哪種：散場之前選了的細類排在其他演出前面；沒答是空陣列 */
  liveKinds: LiveSubcategory[];
}

export function isMediaKey(value: unknown): value is MediaKey {
  return typeof value === "string" && (MEDIA_KEYS as readonly string[]).includes(value);
}

export function isTasteSetting(value: unknown): value is TasteSetting {
  return typeof value === "string" && (TASTE_SETTINGS as readonly string[]).includes(value);
}
