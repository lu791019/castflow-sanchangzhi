/**
 * 人工映射（Q-16）：TMDB 作品 → 平台直連頁。先放 20 部 Netflix 熱門；查不到的作品走 TMDB 快照（JustWatch 中介頁）。
 * 2026-10-13 逐筆核對：TMDB API（zh-TW 片名）＋ `https://www.netflix.com/tw/title/<id>` 200 且頁面含同一中文片名。
 * 下架或換平台時改這裡；之後量大再搬進 work_links(origin='curated')。
 */

export interface CuratedLink {
  source: string;
  label: string;
  url: string;
}

type CuratedKey = `${"movie" | "series"}:${number}`;

function netflix(titleId: number): CuratedLink {
  return { source: "netflix", label: "Netflix", url: `https://www.netflix.com/title/${titleId}` };
}

const CURATED: Readonly<Record<CuratedKey, readonly CuratedLink[]>> = {
  "series:66732": [netflix(80057281)], // 怪奇物語
  "series:93405": [netflix(81040344)], // 魷魚遊戲
  "series:119051": [netflix(81231974)], // 星期三
  "series:65494": [netflix(80025678)], // 王冠
  "series:71446": [netflix(80192098)], // 紙房子
  "series:70523": [netflix(80100172)], // 闇
  "series:91239": [netflix(80232398)], // 柏捷頓家族：名門韻事
  "series:42009": [netflix(70264888)], // 黑鏡
  "series:71912": [netflix(80189685)], // 獵魔士
  "series:87739": [netflix(80234304)], // 后翼棄兵
  "series:136283": [netflix(81519223)], // 黑暗榮耀
  "series:94796": [netflix(81159258)], // 愛的迫降
  "series:197067": [netflix(81518991)], // 非常律師禹英禑
  "series:249042": [netflix(81756069)], // 混沌少年時
  "movie:426426": [netflix(80240715)], // 羅馬
  "movie:398978": [netflix(80175798)], // 愛爾蘭人
  "movie:646380": [netflix(81252357)], // 千萬別抬頭
  "movie:661374": [netflix(81458416)], // 鋒迴路轉：抽絲剝繭
  "movie:49046": [netflix(81260280)], // 西線無戰事
  "movie:803796": [netflix(81498621)], // Kpop 獵魔女團
};

export function curatedFor(kind: "movie" | "series", tmdbId: number): readonly CuratedLink[] {
  return CURATED[`${kind}:${tmdbId}`] ?? [];
}

export const CURATED_COUNT = Object.keys(CURATED).length;
