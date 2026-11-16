"use client";

/** 「我的」頁：重看導覽卡（照 Dex 10/14 影片的設定卡：ⓘ 標題、一行說明、「開始導覽 →」） */

import { requestTourReplay } from "./tour-events";

export function TourReplayCard() {
  return (
    <section data-tour="replay-card" className="mt-11 rounded-control border border-ink-200 px-4 pt-3.5 pb-1">
      <h2 className="m-0 flex items-center gap-2 font-serif-tc text-lede font-bold text-ink-950">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5" />
          <path d="M12 7.6v.01" strokeWidth="2.4" />
        </svg>
        重看導覽
      </h2>
      <p className="mt-1 mb-0 text-caption text-ink-600">七步記下你的第一場</p>
      <button
        type="button"
        onClick={requestTourReplay}
        className="mt-1 flex min-h-11 items-center gap-1.5 text-note font-bold text-ink-950"
      >
        開始導覽
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </section>
  );
}
