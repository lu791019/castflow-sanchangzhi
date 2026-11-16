/** 連結按鈕的共用小零件（server／client 皆可用，純展示） */

import type { WorkLink } from "@/lib/links/types";

/** 往外開：斜箭頭（與資訊欄 InfoBox 同一個） */
export function OutArrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

/** 次鈕：墨線外框（同日誌「說說看」） */
export const SECONDARY_BUTTON =
  "hit-44 inline-flex min-h-9 flex-none items-center rounded-control border border-ink-950 px-3 text-note font-bold text-ink-950 no-underline";

/** 文字鈕：ember，「KKTIX →」 */
export function LinkChip({ link }: { link: WorkLink }) {
  const search = link.origin === "search";
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="hit-44 inline-flex min-h-9 items-center gap-1 text-note font-bold text-ember-dark no-underline"
    >
      {link.label}
      {search ? <span className="font-normal text-ink-600">搜尋</span> : null}
      <OutArrow size={12} />
    </a>
  );
}

const ROW_CLASS = "grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3.5 border-b border-ink-200 text-ink-950 no-underline";

/** 資訊欄的一列：平台／售票站名＋小字＋前往 */
export function LinkRow({ link }: { link: WorkLink }) {
  const note = link.origin === "search" ? "搜尋" : (link.note ?? (link.origin === "user" || link.origin === "manual" ? "讀者補充" : ""));
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
      <span className="font-serif-tc text-prose font-bold">{link.label}</span>
      <span className="text-caption text-ink-700">{note}</span>
      <span className="flex items-center gap-1 text-note font-bold text-ember-dark">
        前往
        <OutArrow />
      </span>
    </a>
  );
}
