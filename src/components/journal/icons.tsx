/**
 * 日誌圖示（設計稿「P1 元件特寫 02 場域圖示一組」）：24 格線、只用直線與折線，像票根上的戳記。
 * 格子用 24px／線寬 1.5，清單用 16px／線寬 1.7。
 */

import type { Venue } from "@/lib/journal/types";
import type { WorkCategory } from "@/lib/journal/wording";

export const VENUE_ICON_PATHS: Record<Venue, string> = {
  home: "M4 11l8-7 8 7M6 10v10h12V10M10 20v-5h4v5",
  cinema: "M3 4h18v9H3zM5 17h4M10 17h4M15 17h4M5 20h4M10 20h4M15 20h4",
  live: "M12 3v3M8 20l4-12 4 12M5 20h14M7 6l2 2M17 6l-2 2",
  exhibition: "M4 6h16v12H4zM7 15l3-3 3 3 2-2 2 2M12 3v3",
  commute: "M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 20v-4M17 20v-4",
  other: "M6 12h.01M12 12h.01M18 12h.01",
};

/** 月曆記號：影劇用迷你海報（不是圖示），其他類別用 13px 小圖示 */
export const CATEGORY_MARK_PATHS: Record<Exclude<WorkCategory, "screen">, string> = {
  podcast: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  // 音符：只用直線與折線（同一組戳記風格）
  music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  live: "M12 3v3M8 20l4-12 4 12M5 20h14",
  exhibition: "M4 6h16v12H4zM7 15l3-3 3 3 2-2 2 2",
};

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function VenueIcon({ venue, size = 22, strokeWidth = 1.5, className }: IconProps & { venue: Venue }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={venue === "other" ? 3 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={VENUE_ICON_PATHS[venue]} />
    </svg>
  );
}

export function MarkIcon({ category, size = 13 }: { category: Exclude<WorkCategory, "screen">; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CATEGORY_MARK_PATHS[category]} />
    </svg>
  );
}

/** 斜線紋：沒有海報時的影劇佔位（ink-50 × paper-2；放映廳時跟著換成 screen-800 × 850） */
export const HATCH_BG = "repeating-linear-gradient(135deg,var(--color-ink-50) 0 5px,var(--color-paper-2) 5px 10px)";
export const HATCH_BG_DARK = "repeating-linear-gradient(135deg,var(--color-ink-300) 0 3px,var(--color-ink-50) 3px 6px)";

export function InboxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 13l2.5-8h11L20 13v6H4z" />
      <path d="M4 13h5l1 2h4l1-2h5" />
    </svg>
  );
}

export function ChevronIcon({ dir, size = 18 }: { dir: "left" | "right"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

export function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function MicIcon({ size = 15, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
