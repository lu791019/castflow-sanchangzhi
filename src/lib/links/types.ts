/** 在哪看／去哪買票／官網：連結的共用型別（散場之前 B） */

export const LINK_KINDS = ["watch", "ticket", "official"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** DB 存的來源；search＝依標題組的搜尋連結（不入庫） */
export type StoredLinkOrigin = "user" | "curated" | "manual" | "tmdb";
export type LinkOrigin = StoredLinkOrigin | "search";

export interface WorkLink {
  kind: LinkKind;
  /** netflix、kktix、opentix、official…；同作品同來源只留一筆 */
  source: string;
  label: string;
  url: string;
  origin: LinkOrigin;
  /** 「訂閱」「租借」或「搜尋」等小字；沒有就 null */
  note: string | null;
}

export interface WorkLinksView {
  watch: WorkLink[];
  ticket: WorkLink[];
  official: WorkLink[];
  /** 沒有任何非搜尋的真連結 → 顯示「還不知道…」＋「你知道？告訴我們」 */
  missing: boolean;
}

export const EMPTY_LINKS: WorkLinksView = { watch: [], ticket: [], official: [], missing: true };

export function isLinkKind(value: unknown): value is LinkKind {
  return LINK_KINDS.some((kind) => kind === value);
}
