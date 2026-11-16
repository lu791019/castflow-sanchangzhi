"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { estimateRemainingMinutes, formatClock, isLongTranscription } from "@/lib/proof/waiting";
import { useAudioDuration } from "./use-audio-duration";

/** 轉錄中多久重新問一次 server（轉好了就換成整理中／校樣） */
const POLL_MS = 8000;
const WAVE =
  "M0 15 Q5 9 10 15 Q15 4 20 15 Q25 26 30 15 Q35 8 40 15 Q45 20 50 15 Q55 2 60 15 Q65 27 70 15 Q75 10 80 15 Q85 19 90 15 Q95 6 100 15 Q105 24 110 15 Q115 11 120 15 Q125 3 130 15 Q135 26 140 15 Q145 9 150 15 Q155 20 160 15 Q165 5 170 15 Q175 25 180 15 Q185 12 190 15 Q195 18 200 15 Q205 7 210 15 Q215 23 220 15 Q225 13 230 15 Q235 4 240 15 Q245 22 250 15 Q255 11 260 15 Q265 17 270 15 Q275 13 280 15 Q285 16 290 15 H300";

export function SayHeader() {
  return (
    <header className="mx-4 grid h-[52px] flex-none grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-ink-950">
      <Link href="/me/desk" aria-label="回編輯檯" className="-ml-3 flex size-11 items-center justify-center text-ink-950">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <span className="pl-[0.2em] text-center font-serif-tc text-lede font-bold tracking-[0.2em] text-ink-950">說一段</span>
      <span />
    </header>
  );
}

function PlayButton({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaying(false));
    else element.pause();
  };
  return (
    <button type="button" onClick={toggle} aria-label={playing ? "暫停原錄音" : "播放原錄音"} className="-ml-1.5 flex size-11 items-center justify-center">
      <audio ref={audio} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <span className="flex size-8 items-center justify-center rounded-full border border-ink-950 text-ink-950">
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-0.5">
            <path d="M6 4v16l14-8z" />
          </svg>
        )}
      </span>
    </button>
  );
}

/** 再說一次／改用打的（Q-54：打字是一等公民，兩個出路並排）；typed＝原本是打字，主鈕改回寫字 */
export function RetryOrType({ retryLabel, typed = false, className = "" }: { retryLabel: string; typed?: boolean; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${className}`}>
      <Link
        href={typed ? "/say?mode=text" : "/say"}
        className="flex h-[52px] items-center justify-center rounded-[4px] bg-ember-dark text-lede font-bold tracking-[0.1em] text-paper no-underline"
      >
        {retryLabel}
      </Link>
      <Link
        href={typed ? "/say" : "/say?mode=text"}
        className="flex h-[52px] items-center justify-center gap-1.5 rounded-[4px] border border-ink-950 text-lede font-bold tracking-[0.1em] text-ink-950 no-underline"
      >
        {typed ? null : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
            <path d="M13 7l4 4" />
          </svg>
        )}
        {typed ? "改用說的" : "改用打的"}
      </Link>
    </div>
  );
}

/** 原話太少（轉錄只出「.」或幾個字）：不送整理，請他再說一次或改用打的（UX-02） */
export function NotHeard({ meta, typed }: { meta: string; typed: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SayHeader />
      <div className="px-4 pt-5">
        <span className="text-eyebrow tracking-[0.1em] text-ink-600 tabular-nums">{meta}</span>
        <h1 className="mt-3 mb-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">
          {typed ? "字太少，還整理不成一篇。" : "沒聽清楚。"}
        </h1>
        <p className="mt-1.5 mb-0 text-lede leading-[1.8] text-ink-800">
          {typed ? "再多寫幾句，或改用說的。" : "再說一次，或改用打的。"}
        </p>
        {typed ? null : (
          <p className="mt-1.5 mb-0 text-caption leading-[1.8] text-ink-600">常見的原因：周圍有點吵，或離手機遠了一點。</p>
        )}
      </div>
      <div className="mt-auto px-4 pt-8 pb-5">
        <RetryOrType retryLabel={typed ? "再寫幾句" : "再說一次"} typed={typed} />
      </div>
    </div>
  );
}

/** 錯誤 1・轉錄失敗：發生了什麼 → 你可以做什麼 → 什麼還在（原錄音） */
export function TranscribeFailed({ meta, audioUrl }: { meta: string; audioUrl: string | null }) {
  const duration = formatClock(useAudioDuration(audioUrl));
  return (
    <div className="flex min-h-dvh flex-col">
      <SayHeader />
      <div className="px-4 pt-5">
        <span className="text-eyebrow tracking-[0.1em] text-ink-600 tabular-nums">{meta}</span>
        <div aria-hidden="true" className="p2-manuscript relative mt-3 h-[211px] w-full max-w-[331px]">
          <svg width="300" height="30" viewBox="0 0 300 30" fill="none" className="absolute top-[30px] left-4 block max-w-[calc(100%-32px)]">
            <path d={WAVE} stroke="var(--color-ink-300)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {duration ? (
            <span className="absolute top-16 right-2 bg-paper px-1 text-eyebrow text-ink-600 tabular-nums">{duration}</span>
          ) : null}
        </div>
        <h1 className="mt-6 mb-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">這段沒有轉成文字。</h1>
        <p className="mt-1.5 mb-0 text-lede leading-[1.8] text-ink-800">可以再錄一次，或改用打的。</p>
        <p className="mt-1.5 mb-0 text-caption leading-[1.8] text-ink-600">常見的原因：周圍有點吵，或離手機遠了一點。</p>
      </div>

      <div className="mt-auto px-4 pt-8 pb-5">
        {audioUrl ? (
          <div className="grid min-h-14 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 border-y border-ink-200">
            <PlayButton url={audioUrl} />
            <span className="text-note text-ink-900">
              原錄音已保留
              {duration ? <span className="ml-2 text-ink-700 tabular-nums">{duration}</span> : null}
            </span>
            <span className="text-eyebrow text-ink-600">放在編輯檯草稿</span>
          </div>
        ) : null}
        <RetryOrType retryLabel="再錄一次" className="mt-4" />
      </div>
    </div>
  );
}

const STEPS = ["轉錄・進行中", "整理", "校樣"];

/** 等待 5・轉錄中：稿紙格線＋燒橙游標；預估超過 2 分鐘才說「大約還要 n 分鐘」 */
export function Transcribing({ meta, audioUrl, createdAt }: { meta: string; audioUrl: string | null; createdAt: string }) {
  const router = useRouter();
  const duration = useAudioDuration(audioUrl);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.parse(createdAt);
    const timer = window.setInterval(() => {
      setElapsed(Math.max(0, (Date.now() - started) / 1000));
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [createdAt, router]);

  const remaining = estimateRemainingMinutes(duration, elapsed);
  const long = isLongTranscription(remaining);
  const clock = formatClock(duration);

  return (
    <div className="flex min-h-dvh flex-col">
      <SayHeader />
      <div className="px-4 pt-5">
        <span className="text-eyebrow tracking-[0.1em] text-ink-600 tabular-nums">
          {meta}
          {clock ? `・錄音 ${clock}` : ""}・已收到
        </span>
        <div aria-hidden="true" className="p2-manuscript relative mt-3 h-[241px] w-full max-w-[331px]">
          <span className="absolute top-px left-px flex size-[30px] items-center justify-center">
            <span className="p2-caret block h-[18px] w-0.5 bg-ember" />
          </span>
        </div>
        <h1 className="mt-6 mb-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">正在把你說的，寫成文字</h1>
        {long ? (
          <p role="status" className="mt-1.5 mb-0 text-lede font-bold text-ember-dark">
            大約還要 {remaining} 分鐘
          </p>
        ) : null}
        <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">
          {long ? "可以先關掉，好了會放在編輯檯。說得長是好事，寫進稿紙需要一點時間。" : "通常一兩分鐘。可以先關掉，好了會放在編輯檯。"}
        </p>
        <ol className="mt-[18px] flex list-none gap-[18px] border-t border-ink-200 p-0 pt-3 text-caption">
          {STEPS.map((step, index) => (
            <li key={step} className={index === 0 ? "font-bold text-ember-deep" : "text-ink-600"}>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
