/**
 * 連結合併（純函式）：使用者補的 > 場刊手填 > curated 映射 > TMDB 快照 > 搜尋連結。
 * 同一 kind＋source 只留最優先的一筆；同優先序保留輸入順序（搜尋連結已依 venue_type 排好）。
 */

import type { WorkKind } from "@/lib/works/format";
import type { LinkKind, LinkOrigin, WorkLink, WorkLinksView } from "./types";

const ORIGIN_RANK: Record<LinkOrigin, number> = { user: 0, manual: 1, curated: 2, tmdb: 3, search: 4 };

/** 各作品類型要顯示的連結種類（依重要度）；Podcast、音樂的「在哪聽」另有區塊，不參與 */
const KINDS_FOR: Record<WorkKind, readonly LinkKind[]> = {
  movie: ["watch", "ticket", "official"],
  series: ["watch", "official"],
  live: ["ticket", "official"],
  exhibition: ["ticket", "official"],
  podcast_episode: [],
  music: [],
};

export function isRealLink(link: WorkLink): boolean {
  return link.origin !== "search";
}

/** 去重＋依來源優先序穩定排序，只留該作品類型用得到的 kind */
export function orderLinks(workKind: WorkKind, links: readonly WorkLink[]): WorkLink[] {
  const kinds = KINDS_FOR[workKind];
  const ranked = links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => kinds.includes(link.kind))
    .sort((a, b) => ORIGIN_RANK[a.link.origin] - ORIGIN_RANK[b.link.origin] || a.index - b.index);
  const seen = new Set<string>();
  return ranked.flatMap(({ link }) => {
    const key = `${link.kind}:${link.source}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [link];
  });
}

export function mergeWorkLinks(workKind: WorkKind, links: readonly WorkLink[]): WorkLinksView {
  const ordered = orderLinks(workKind, links);
  const byKind = (kind: LinkKind) => ordered.filter((link) => link.kind === kind);
  return {
    watch: byKind("watch"),
    ticket: byKind("ticket"),
    official: byKind("official"),
    missing: KINDS_FOR[workKind].length > 0 && !ordered.some(isRealLink),
  };
}

/** 列表（接下來、散場之前卡片）的單顆次鈕：真連結優先（依 kind 重要度），否則第一顆搜尋連結 */
export function primaryLink(workKind: WorkKind, links: readonly WorkLink[]): WorkLink | null {
  const kinds = KINDS_FOR[workKind];
  const ordered = orderLinks(workKind, links);
  const real = ordered
    .filter(isRealLink)
    .map((link, index) => ({ link, index }))
    .sort((a, b) => kinds.indexOf(a.link.kind) - kinds.indexOf(b.link.kind) || a.index - b.index);
  return real[0]?.link ?? ordered.find((link) => !isRealLink(link)) ?? null;
}

/** 次鈕的字：「去哪買票」「在哪看」「官網」 */
export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  watch: "在哪看",
  ticket: "去哪買票",
  official: "官網",
};

/** 「你知道？告訴我們」可選的種類（依作品類型） */
const TELL_US_KINDS: Record<WorkKind, LinkKind[]> = {
  movie: ["watch", "ticket"],
  series: ["watch"],
  live: ["ticket", "official"],
  exhibition: ["official", "ticket"],
  podcast_episode: [],
  music: [],
};

export function tellUsKinds(kind: WorkKind): LinkKind[] {
  return TELL_US_KINDS[kind];
}

/** 讀者剛補、已生效的連結直接放進畫面（不等 server 重讀）：放同類第一個、同來源只留新的、不再缺 */
export function withAddedLink(view: WorkLinksView, link: WorkLink): WorkLinksView {
  return { ...view, [link.kind]: [link, ...view[link.kind].filter((item) => item.source !== link.source)], missing: false };
}
