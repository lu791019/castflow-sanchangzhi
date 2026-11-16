"use client";

/** 日誌頁的互動小元件：只記不說、記第一筆、/journal/new 自動打開記一筆 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLogSheet } from "@/components/journal/log-sheet-provider";
import { restoredPrefill } from "@/components/journal/log-draft-store";
import type { EmptyMonthPrefill } from "@/lib/journal/empty-month";
import type { RecentLogWork } from "@/lib/journal/recent-works";

export function SkipButton({ entryId, className }: { entryId: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const skip = async () => {
    setPending(true);
    setFailed(false);
    const response = await fetch(`/api/journal/${encodeURIComponent(entryId)}/skip`, { method: "POST" }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setFailed(true);
      return;
    }
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={skip}
      disabled={pending}
      className={className ?? "min-h-11 text-caption text-ink-600 disabled:opacity-50"}
    >
      {failed ? "沒成功，再按一次" : "只記不說"}
    </button>
  );
}

/** 空月份的按鈕：本月「記第一筆」、過去「補記一筆」、未來「排一場」（UX-24） */
export function FirstEntryButton({ label, prefill }: { label: string; prefill?: EmptyMonthPrefill }) {
  const { openLogSheet } = useLogSheet();
  return (
    <button
      type="button"
      onClick={() => openLogSheet(prefill ? { prefill } : undefined)}
      className="mt-[18px] inline-flex min-h-11 items-center self-start rounded-control border border-ink-950 px-[18px] text-note font-bold text-ink-950"
    >
      {label}
    </button>
  );
}

/** /journal/new：進頁就打開記一筆；關掉（或記下後）回到日誌。resume：訪客登入回來，還原剛剛填的（UX-03） */
/** work：收聽提醒（Spotify 聽完一張專輯）帶進來的作品，預選；登入回來還原（resume）優先 */
export function AutoOpenLogSheet({ resume = false, work = null }: { resume?: boolean; work?: RecentLogWork | null }) {
  const router = useRouter();
  const { openLogSheet } = useLogSheet();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const prefill = (resume ? restoredPrefill() : null) ?? (work ? { work } : null);
    openLogSheet({ afterClose: () => router.replace("/journal"), ...(prefill ? { prefill } : {}) });
  }, [openLogSheet, resume, router, work]);
  return null;
}
