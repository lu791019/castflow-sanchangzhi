/** 「本週熱門」：選擇面板還沒打字時先給人看的清單（Dex 10/13 拍板：不能讓人面對空白搜尋框） */

import type { MusicAlbumResult, PickerKind, PodcastShowResult, ScreenResult } from "@/lib/work-picker/types";

export interface TrendingSection<T> {
  key: string;
  /** 畫面上的小標，例如「正在上映」；只寫 Apple／TMDB 以外的字，之後換來源不改畫面 */
  title: string;
  items: T[];
}

export type TrendingPayload =
  | { kind: "movie" | "series"; sections: TrendingSection<ScreenResult>[]; fetchedAt: string }
  | { kind: "podcast"; sections: TrendingSection<PodcastShowResult>[]; fetchedAt: string }
  | { kind: "music"; sections: TrendingSection<MusicAlbumResult>[]; fetchedAt: string };

export function isPickerKind(value: unknown): value is PickerKind {
  return value === "movie" || value === "series" || value === "podcast" || value === "music";
}
