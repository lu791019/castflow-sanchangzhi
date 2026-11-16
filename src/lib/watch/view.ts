/**
 * 「在哪看／在哪聽」四種狀態的呈現（設計稿 P2 在哪看・四種狀態）：
 * A 有平台（文字列 + 斜箭頭往外）/ B 只有院線 / C 沒有資料 / D Podcast 在哪聽（+ 站內讀逐字稿，直箭頭）。
 * 不放平台 logo、不放假連結；「上了平台時告訴我」沒有後端，不畫。
 */

import type { PlatformRow, WatchInfo } from "./service";

export type WatchMode = "list" | "theaters" | "none";

export interface WatchSectionView {
  heading: string;
  headerNote: string;
  mode: WatchMode;
  rows: PlatformRow[];
  /** 院線態副標：「院線・10.03 起」 */
  theatersLine: string | null;
  /** 無資料態主句 */
  emptyLine: string | null;
  /** 區塊底部小字 */
  footnote: string | null;
  /** Podcast：站內單集閱讀頁 */
  readHref: string | null;
}

export interface WatchSectionInput {
  podcast: boolean;
  info: WatchInfo;
  readHref?: string | null;
}

function sinceLabel(since: string | null | undefined): string {
  const match = since ? /^\d{4}-(\d{2})-(\d{2})$/.exec(since) : null;
  return match ? `院線・${match[1]}.${match[2]} 起` : "院線";
}

export function watchSectionView({ podcast, info, readHref = null }: WatchSectionInput): WatchSectionView {
  const base = { rows: [] as PlatformRow[], theatersLine: null, emptyLine: null, footnote: null, readHref: null };
  if (podcast) {
    const hasRows = info.status === "available" && info.platforms.length > 0;
    return {
      ...base,
      heading: "在哪聽",
      headerNote: "收聽平台",
      mode: hasRows ? "list" : "none",
      rows: hasRows ? info.platforms : [],
      emptyLine: hasRows || readHref ? null : "這個節目目前查不到收聽平台。",
      readHref,
    };
  }
  if (info.status === "available" && info.platforms.length > 0) {
    return {
      ...base,
      heading: "在哪看",
      headerNote: info.attribution ? "台灣地區・JustWatch" : "台灣地區",
      mode: "list",
      rows: info.platforms,
      footnote: ["上架資訊以各平台為準。", info.attribution].filter(Boolean).join(""),
    };
  }
  if (info.status === "in_theaters") {
    return {
      ...base,
      heading: "在哪看",
      headerNote: "台灣地區・TMDB",
      mode: "theaters",
      theatersLine: sinceLabel(info.since),
      footnote: "場次請洽各戲院。",
    };
  }
  return {
    ...base,
    heading: "在哪看",
    headerNote: "台灣地區",
    mode: "none",
    emptyLine: "這部目前查不到線上平台。",
    footnote: "資料來源：JustWatch、TMDB・每天更新",
  };
}
