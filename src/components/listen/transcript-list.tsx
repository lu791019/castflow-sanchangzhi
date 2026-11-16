"use client";

import { useEffect, useRef } from "react";
import { formatClock } from "@/lib/listen/duration";
import { segmentLines, type DisplaySegment, type LangMode } from "@/lib/listen/display";

/** 手動捲動後暫停跟隨的時間（P0 Token：motion.follow） */
export const FOLLOW_PAUSE_MS = 5000;

interface TranscriptListProps {
  segments: DisplaySegment[];
  langMode: LangMode;
  activeIndex: number;
  /** 聽模式且播放中才自動捲動 */
  follow: boolean;
  onSeek: (seconds: number) => void;
}

/** 使用者手動捲動（滾輪、觸控、鍵盤）後暫停跟隨 5 秒；程式捲動不觸發這些事件 */
function useManualScrollPause() {
  const pausedUntil = useRef(0);
  useEffect(() => {
    const pause = () => {
      pausedUntil.current = Date.now() + FOLLOW_PAUSE_MS;
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) pause();
    };
    window.addEventListener("wheel", pause, { passive: true });
    window.addEventListener("touchmove", pause, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", pause);
      window.removeEventListener("touchmove", pause);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return pausedUntil;
}

export function TranscriptList({ segments, langMode, activeIndex, follow, onSeek }: TranscriptListProps) {
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pausedUntil = useManualScrollPause();

  useEffect(() => {
    if (!follow || activeIndex < 0 || Date.now() < pausedUntil.current) return;
    const node = itemRefs.current[activeIndex];
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [activeIndex, follow, pausedUntil]);

  return (
    <section aria-label="逐字稿" className="listen-transcript mx-4 mt-1" data-transcript>
      {segments.map((segment, index) => {
        const playing = index === activeIndex;
        const lines = segmentLines(segment, langMode);
        return (
          <div
            key={`${segment.start}-${index}`}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            aria-current={playing ? "true" : undefined}
            className={`relative grid grid-cols-[44px_minmax(0,1fr)] gap-x-2 border-b border-ink-50 ${
              playing
                ? "-mx-4 bg-ember-tint py-3.5 pr-4 pl-3.5 shadow-[inset_2px_0_0_var(--color-ember)]"
                : "py-3.5"
            }`}
          >
            <button
              type="button"
              onClick={() => onSeek(segment.start)}
              aria-label={`從 ${formatClock(segment.start)} 開始播放`}
              className="flex min-h-11 items-start border-0 bg-transparent p-0 pt-0.5 font-sans-tc text-eyebrow text-ink-600 tabular-nums"
            >
              {formatClock(segment.start)}
            </button>
            <div className="min-w-0">
              {segment.speaker ? (
                <span
                  className={`text-eyebrow font-bold tracking-[0.14em] ${
                    playing ? "text-ember-deep" : "text-ink-700"
                  }`}
                >
                  {segment.speaker}
                </span>
              ) : null}
              {lines.source ? (
                <p
                  lang="en"
                  className={`m-0 text-lede leading-[1.7] ${playing ? "text-ink-800" : "text-ink-700"} ${
                    segment.speaker ? "mt-1" : ""
                  }`}
                >
                  {lines.source}
                </p>
              ) : null}
              {lines.zh ? (
                <p
                  className={`mb-0 text-prose leading-[1.85] tracking-[0.02em] ${
                    playing ? "text-ink-950" : "text-ink-900"
                  } ${lines.source || segment.speaker ? "mt-1" : "mt-0"}`}
                >
                  {lines.zh}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}
