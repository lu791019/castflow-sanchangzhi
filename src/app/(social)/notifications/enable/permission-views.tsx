"use client";

/** 通知權限引導 sheet（設計稿原文）與權限結果的狀態面板 */

import { HATCH_BG } from "@/components/journal/icons";
import { FallbackImg } from "@/components/ui/fallback-img";
import type { EnableState, FirstEntryCard } from "./enable-notifications";

interface PermissionSheetProps {
  card: FirstEntryCard | null;
  preview: { title: string; body: string };
  busy: boolean;
  error: string | null;
  onEnable: () => void;
  onSkip: () => void;
}

function Backdrop() {
  return (
    <div aria-hidden="true">
      <header className="mx-4 flex h-[52px] items-center border-b border-ink-950">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">散場誌</span>
      </header>
      <div className="fixed inset-0 bg-scrim" />
    </div>
  );
}

export function PermissionSheet({ card, preview, busy, error, onEnable, onSkip }: PermissionSheetProps) {
  return (
    <div className="min-h-dvh">
      <Backdrop />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[480px] animate-sheet-up flex-col rounded-t-control bg-paper px-4 pt-2 pb-5"
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-[2px] bg-ink-300" />
        {card ? (
          <div className="relative mt-[18px] flex items-center gap-3 rounded-control border border-ink-200 px-3.5 py-3">
            <FallbackImg
              src={card.posterUrl}
              className="h-12 w-8 flex-none object-cover"
              fallback={<span aria-hidden="true" className="block h-12 w-8 flex-none" style={{ background: HATCH_BG }} />}
            />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-eyebrow tracking-[0.16em] text-ink-600">你的第一筆</span>
              <span className="font-serif-tc text-lede font-bold text-ink-950">
                《{card.title}》・{card.place}
              </span>
            </span>
            <span aria-hidden="true" className="-rotate-6 rounded-control border-[1.5px] border-stamp-ink px-2 py-1 text-eyebrow font-bold tracking-[0.1em] text-stamp-ink">
              記下了
            </span>
          </div>
        ) : null}
        <h1 id="perm-title" className="mt-6 mb-0 font-serif-tc text-section leading-[1.55] font-bold text-ink-950">
          明天中午，
          <br />
          要我們問你一聲嗎？
        </h1>
        <p className="mt-2.5 mb-0 text-note leading-[1.85] text-ink-800">
          我們會在你看完後隔天問你一次：想不想說說。
          <br />
          只問這一次，不會推廣告，也不會催你。
        </p>
        <div aria-hidden="true" className="mt-4 flex flex-col gap-0.5 rounded-control bg-paper-2 px-3 py-2.5">
          <span className="flex justify-between text-eyebrow text-ink-600">
            <span>散場誌</span>
            <span>明天 12:00</span>
          </span>
          <span className="text-note font-bold text-ink-950">{preview.title}</span>
          <span className="text-note text-ink-800">{preview.body}</span>
        </div>
        {error ? (
          <p role="alert" className="mt-3 mb-0 text-caption text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onEnable}
          disabled={busy}
          className="mt-[22px] h-[52px] rounded-control bg-action-primary text-lede font-bold tracking-[0.1em] text-paper disabled:opacity-60"
        >
          好，提醒我
        </button>
        <button type="button" onClick={onSkip} className="mt-1 min-h-11 text-note text-ink-700">
          先不用
        </button>
        <p className="mt-1 mb-0 text-center text-eyebrow leading-relaxed text-ink-600">
          選「先不用」也沒關係，提醒會留在 App 的收件匣裡。
          <br />
          之後可以在「我的 › 設定 › 提醒」改。
        </p>
      </section>
    </div>
  );
}

const STATUS_COPY: Record<"granted" | "denied" | "unsupported", { title: string; body: string }> = {
  granted: {
    title: "提醒開好了。",
    body: "看完之後隔天，我們會問你一次想不想說說。只問一次，不會推廣告。",
  },
  denied: {
    title: "通知目前是關著的。",
    body: "瀏覽器擋下了散場誌的通知。想收到提醒，可以到瀏覽器或手機的設定裡打開。沒開也沒關係，提醒會留在收件匣裡。",
  },
  unsupported: {
    title: "這個瀏覽器收不到通知。",
    body: "沒關係，提醒會留在 App 的收件匣裡，不會不見。",
  },
};

export function StatusPanel({ state, onBack }: { state: Exclude<EnableState, "checking" | "ask" | "ios-home" | "failed">; onBack: () => void }) {
  const copy = STATUS_COPY[state];
  return (
    <div className="flex min-h-dvh flex-col px-4">
      <header className="flex h-[52px] items-center border-b border-ink-950">
        <span className="text-caption font-bold tracking-[0.3em] text-ember-dark">通知</span>
      </header>
      <h1 className="mt-6 mb-0 font-serif-tc text-section leading-[1.55] font-bold text-ink-950">{copy.title}</h1>
      <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">{copy.body}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 h-[52px] rounded-control bg-action-primary text-lede font-bold tracking-[0.1em] text-paper"
      >
        回日誌
      </button>
    </div>
  );
}
