"use client";

/** 刊頭小 ⓘ：重看導覽（散場之前給登入者、目錄頁首給訪客） */

import { requestTourReplay } from "./tour-events";

export function TourInfoButton({ tour, className = "" }: { tour: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={requestTourReplay}
      aria-label="重看導覽"
      data-tour={tour}
      className={`-mr-2.5 flex size-11 flex-none items-center justify-center text-ink-600 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <path d="M12 7.6v.01" strokeWidth="2.2" />
      </svg>
    </button>
  );
}
