"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import type { ReminderTiming } from "@/lib/journal/types";
import { needsAddToHome, notifyStatusLine, reminderTitle, type NotifyState } from "@/lib/me/settings";
import { ChevronIcon } from "./settings-parts";
import { ReminderSheet } from "./reminder-sheet";

const ENABLE_PATH = "/notifications/enable";

function readNotifyState(): NotifyState {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission;
}

function readNeedsHome(): boolean {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return needsAddToHome(navigator.userAgent, standalone, navigator.maxTouchPoints);
}

const noSubscribe = () => () => {};

async function putTiming(timing: ReminderTiming): Promise<string | null> {
  try {
    const response = await fetch("/api/journal/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timing }),
    });
    if (response.ok) return null;
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? "沒有存進去，稍後再試一次";
  } catch {
    return "連不上，沒有存進去";
  }
}

/** 二、提醒：提醒時間（點開 sheet）、通知權限、iPhone 未加主畫面提示 */
export function ReminderSection({ initialTiming }: { initialTiming: ReminderTiming }) {
  const [timing, setTiming] = useState(initialTiming);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  // 權限與裝置只能在瀏覽器讀；server 端先當成「尚未開啟」
  const notify = useSyncExternalStore<NotifyState>(noSubscribe, readNotifyState, () => "default");
  const needsHome = useSyncExternalStore(noSubscribe, readNeedsHome, () => false);

  const save = (next: ReminderTiming) => {
    setError(null);
    startTransition(async () => {
      const failed = await putTiming(next);
      if (failed) return setError(failed);
      setTiming(next);
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[52px] w-full items-center justify-between border-b border-ink-200 text-left text-lede text-ink-950"
      >
        <span>提醒時間</span>
        <span className="flex items-center gap-2 text-note text-ink-600">
          {reminderTitle(timing)}
          <ChevronIcon />
        </span>
      </button>
      <div className="flex min-h-[60px] items-center justify-between gap-3 border-b border-ink-200">
        <span className="flex flex-col gap-0.5">
          <span className="text-lede text-ink-950">通知</span>
          <span className="text-caption text-ink-600">{notifyStatusLine(notify)}</span>
        </span>
        {notify === "granted" ? null : (
          <Link href={ENABLE_PATH} className="flex min-h-11 items-center gap-1 text-note font-bold text-ember-dark no-underline">
            開啟
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>
      {needsHome ? (
        <div className="mt-3 grid grid-cols-[22px_minmax(0,1fr)] gap-x-2.5 bg-paper-2 px-3 pt-3 pb-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <div className="flex flex-col">
            <span className="text-note leading-[1.7] text-ink-800">在 iPhone 上，要先把散場誌放到主畫面，才收得到提醒。</span>
            <Link href={ENABLE_PATH} className="flex min-h-10 items-center self-start text-note font-bold text-ember-dark no-underline">
              怎麼放，十秒鐘 ›
            </Link>
          </div>
        </div>
      ) : null}
      {open ? (
        <ReminderSheet initial={timing} saving={saving} error={error} onClose={() => setOpen(false)} onSave={save} />
      ) : null}
    </>
  );
}
