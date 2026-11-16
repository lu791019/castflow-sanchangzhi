"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { approxCharCount, formatClock } from "@/lib/proof/waiting";
import type { GenerateFailReason } from "@/lib/proof/failure";
import { generateProofAction } from "./actions";
import { NotHeard } from "./proof-transcribe";

export interface GenerateContext {
  /** 「《海街日記》・10.10 22:14 說的」 */
  meta: string;
  transcript: string;
  durationSeconds: number | null;
  /** 原本是打字（source=text）：失敗頁的出路改成「再寫幾句／改用說的」 */
  typed?: boolean;
}

function BackHeader() {
  return (
    <header className="mx-4 grid h-[52px] flex-none grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-ink-950">
      <Link href="/me/desk" aria-label="返回編輯檯" className="-ml-3 flex size-11 items-center justify-center text-ink-950">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <span className="pl-[0.4em] text-center text-caption font-bold tracking-[0.4em] text-ember-dark">校樣</span>
      <span />
    </header>
  );
}

/** 錯誤 2・整理失敗：文字在，再整理一版；可展開看原本說的（逐字稿，未經整理）。offerTyping：也給「改用打的」 */
export function GenerateFailed({
  context,
  onRetry,
  offerTyping = false,
}: {
  context: GenerateContext;
  onRetry: () => void;
  offerTyping?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const clock = formatClock(context.durationSeconds);
  const size = [clock, approxCharCount(context.transcript)].filter(Boolean).join("・");
  return (
    <div className="flex min-h-dvh flex-col">
      <BackHeader />
      <div className="px-4 pt-5">
        <span className="text-eyebrow tracking-[0.1em] text-ink-600 tabular-nums">{context.meta}</span>
        <h1 className="mt-3 mb-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">文字在，但這次沒整理好。</h1>
        <p className="mt-1.5 mb-0 text-note leading-[1.8] text-ink-700">你說的話都在，一個字也沒少。再整理一次，通常就好了。</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-[18px] h-[52px] w-full rounded-[4px] bg-ember-dark text-lede font-bold tracking-[0.16em] text-paper"
        >
          再整理一版
        </button>
        {offerTyping ? (
          <Link
            href={context.typed ? "/say" : "/say?mode=text"}
            className="mt-2 flex min-h-11 items-center justify-center text-note text-ink-700 underline underline-offset-4"
          >
            {context.typed ? "改用說的" : "改用打的"}
          </Link>
        ) : null}
      </div>
      <div className="mx-4 mt-6 border-t border-ink-950">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="raw"
          onClick={() => setOpen(!open)}
          className="grid min-h-[52px] w-full grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-x-2.5 border-b border-ink-200 text-left"
        >
          <span className="text-lede font-bold text-ink-950">看原本說的</span>
          <span className="text-caption text-ink-600 tabular-nums">{size}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-700)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open ? (
          <div id="raw" className="pt-1.5 pb-6">
            <p className="p2-ruled m-0 text-lede tracking-[0.03em] whitespace-pre-wrap text-ink-800">{context.transcript}</p>
            <span className="mt-1.5 block text-eyebrow text-ink-600">逐字稿，未經整理</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 有逐字稿、還沒有文章：自動整理一版，完成後重新載入校樣；失敗換成整理失敗頁。
 * initialFailure：既有草稿的正文是模型拒絕訊息（UX-02），直接顯示失敗、不自動重跑。
 */
export function ProofGenerating({
  episodeId,
  context,
  initialFailure,
}: {
  episodeId: string;
  context: GenerateContext;
  initialFailure?: GenerateFailReason;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<{ reason?: GenerateFailReason } | null>(
    initialFailure ? { reason: initialFailure } : null,
  );
  const started = useRef(Boolean(initialFailure));

  // setState 只在 promise callback 內，不在 effect 本體同步觸發
  const run = useCallback(() => {
    generateProofAction(episodeId).then(
      (result) => {
        if (result.ok) router.refresh();
        else setFailure({ reason: result.reason });
      },
      () => setFailure({}),
    );
  }, [episodeId, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  const retry = () => {
    setFailure(null);
    run();
  };

  if (failure?.reason === "too_short") return <NotHeard meta={context.meta} typed={Boolean(context.typed)} />;
  if (failure) return <GenerateFailed context={context} onRetry={retry} offerTyping={failure.reason === "refused"} />;
  return <ProofWaiting title="正在幫你整理…" note="大約一分鐘。整理好就會出現校樣，確認後才會發佈。" />;
}

export function ProofWaiting({ title, note, onRetry }: { title: string; note: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="pl-[0.4em] text-caption font-bold tracking-[0.4em] text-ember-dark">校樣</span>
      <h1 className="m-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">{title}</h1>
      <p className="m-0 text-note leading-[1.8] text-ink-700">{note}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="min-h-11 rounded-[4px] bg-ink-950 px-5 text-note font-bold text-paper">
          再試一次
        </button>
      ) : null}
      <Link href="/" className="text-note text-ink-600 underline underline-offset-4">
        先回目錄
      </Link>
    </div>
  );
}
