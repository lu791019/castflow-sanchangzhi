"use client";

/** 登入回來後的提示：剛剛說的／寫的還在，由使用者決定送出或重來 */

import { formatClock } from "@/lib/say/stage";

export interface RestoredBannerProps {
  kind: "text" | "voice";
  /** 錄音秒數（kind=voice） */
  seconds?: number;
  onSubmit?: () => void;
  onDiscard: () => void;
}

export function RestoredBanner({ kind, seconds = 0, onSubmit, onDiscard }: RestoredBannerProps) {
  return (
    <div role="status" className="mx-4 mt-4 border-l-2 border-ember bg-ink-900 px-3.5 py-3">
      <p className="m-0 text-note leading-[1.8] text-paper">
        {kind === "voice"
          ? `登入好了。剛剛說的 ${formatClock(seconds)} 還在。`
          : "登入好了。剛剛寫的還在，確認後再送出。"}
      </p>
      <div className="mt-1 flex gap-4">
        {kind === "voice" && onSubmit ? (
          <button type="button" onClick={onSubmit} className="min-h-11 text-note font-bold text-ember-soft">
            送出這段
          </button>
        ) : null}
        <button type="button" onClick={onDiscard} className="min-h-11 text-note text-ink-400">
          {kind === "voice" ? "重錄" : "清掉重寫"}
        </button>
      </div>
    </div>
  );
}
