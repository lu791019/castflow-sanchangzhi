"use client";

import type { LoggedEntry } from "./log-sheet";

/** 記下後的短回饋：疊在底部導航上方，「再記一筆」重新打開 sheet */
export function LogToast({ entry, onAgain }: { entry: LoggedEntry; onAgain: () => void }) {
  return (
    <div data-tour="log-toast" className="pointer-events-none fixed inset-x-0 bottom-[100px] z-40 mx-auto w-full max-w-[480px] px-4">
      <div
        role="status"
        aria-live="polite"
        className="p4-inverse pointer-events-auto flex min-h-[52px] animate-toast-in items-center gap-2.5 rounded-control bg-ink-950 py-0 pr-1.5 pl-4 text-paper"
      >
        <span className="flex-1 text-note leading-normal">
          記下了{entry.live ? `「${entry.workTitle}」` : `《${entry.workTitle}》`}。<span className="text-ink-300">{entry.toast}</span>
        </span>
        <button
          type="button"
          onClick={onAgain}
          className="min-h-11 px-2.5 text-note font-bold text-ember-soft"
        >
          再記一筆
        </button>
      </div>
    </div>
  );
}
