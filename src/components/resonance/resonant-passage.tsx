"use client";

/**
 * 可留「這句我也是」的一段正文：
 * - 長按段落 450ms 或點段尾 44×44 隱形按鈕 → 段落上方浮出浮層（ember-100 墨暈底同步出現）
 * - 句邊：他人＝ink-300 1px 線＋ink-600 人數；有你＝燒橙 2px 線（＋ember-dark 粗體人數，只有你時不寫）
 * 點一下段落只是閱讀，不打擾。版位見 P3 Token article.gutter（正文左 28，數字在 x=4，線在 x=19）。
 */

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { VerticalDigits } from "@/components/ui/vertical-digits";
import { passageMarkView } from "@/lib/resonance/marks";
import { movedTooFar, RESONANCE_LONG_PRESS_MS } from "@/lib/motion/resonance";
import { usePassageResonance } from "./resonance-provider";
import "./resonance.css";

interface ResonantPassageProps {
  hash: string;
  className?: string;
  children: ReactNode;
  /** 段尾收筆記號等，放在文字之後、隱形按鈕之前 */
  trailing?: ReactNode;
}

function lineClass(state: string, change: string | null): string {
  const mine = state === "mine" || state === "both";
  if (mine) return change === "draw" ? "resonance-line-draw" : "";
  return change === "fade" ? "resonance-line-fade" : "hidden";
}

export function ResonantPassage({ hash, className = "", children, trailing }: ResonantPassageProps) {
  const { mark, selected, change, select, toggle } = usePassageResonance(hash);
  const view = passageMarkView(mark);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const mine = view.state === "mine" || view.state === "both";

  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  useEffect(() => cancelPress, []);

  useEffect(() => {
    if (selected) actionRef.current?.focus({ preventScroll: true });
  }, [selected]);

  const onPointerDown = (event: PointerEvent<HTMLParagraphElement>) => {
    if (event.button !== 0) return;
    cancelPress();
    origin.current = { x: event.clientX, y: event.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      window.getSelection()?.removeAllRanges();
      select(hash);
    }, RESONANCE_LONG_PRESS_MS);
  };

  const onPointerMove = (event: PointerEvent<HTMLParagraphElement>) => {
    if (!origin.current) return;
    if (movedTooFar(event.clientX - origin.current.x, event.clientY - origin.current.y)) cancelPress();
  };

  return (
    <div className={`relative ${selected ? "z-50" : ""}`} data-passage={hash} data-resonance-state={view.state}>
      <span
        aria-hidden="true"
        className={`absolute top-[7px] bottom-[7px] -left-2 block w-px bg-ink-300 ${view.state === "others" ? "" : "hidden"}`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-[7px] bottom-[7px] -left-[9px] block w-0.5 bg-ember ${lineClass(view.state, change)}`}
      />
      <span
        aria-hidden="true"
        data-resonance-count
        className={`absolute top-2 -left-6 block w-[11px] font-serif-tc text-[11px] leading-[11px] tracking-[1px] transition-colors duration-150 [writing-mode:vertical-rl] motion-reduce:transition-none ${
          mine ? "font-bold text-ember-dark" : "font-normal text-ink-600"
        }`}
      >
        <VerticalDigits text={view.numeral} />
      </span>
      {/* 浮層放在 <p> 前面，避免影響段落的 :last-child 間距 */}
      {selected ? (
        <div data-resonance-popover className="resonance-pop absolute bottom-full left-1/2 mb-2.5">
          <button
            ref={actionRef}
            type="button"
            onClick={() => toggle(hash)}
            className="p4-inverse relative flex h-11 items-center gap-2.5 rounded-[4px] border-0 bg-ink-950 pr-[18px] pl-3.5 text-[13px] font-bold tracking-[0.12em] whitespace-nowrap text-paper"
          >
            <span aria-hidden="true" className="block h-3.5 w-0.5 bg-ember-soft" />
            {view.actionLabel}
            <span
              aria-hidden="true"
              className="absolute -bottom-[5px] left-1/2 -ml-[5px] block size-2.5 rotate-45 bg-ink-950"
            />
          </button>
        </div>
      ) : null}
      <p
        className={`resonance-passage ${className}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(event) => {
          if (timer.current || selected) event.preventDefault();
        }}
      >
        <span className="resonance-passage-text" data-selected={selected}>
          {children}
        </span>
        {trailing}
        <button
          type="button"
          aria-label={view.buttonLabel}
          onClick={() => select(selected ? null : hash)}
          className="-mx-[15px] -my-[13px] box-content inline-block h-[18px] w-3.5 cursor-pointer border-0 bg-transparent px-[15px] py-[13px] align-middle"
        />
      </p>
    </div>
  );
}
