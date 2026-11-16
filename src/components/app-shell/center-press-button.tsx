"use client";

/**
 * 底部中央圓鈕（設計稿「P1 元件特寫 01」＋「P4 動效 〇一」）：點一下＝記一筆，按住＝說一段。
 * - 按下：下沉 2px（點與按住共用同一個「按下」）；按住滿 120ms 圖示＋→麥克風
 * - 400ms 內放開 → 點一下；弧線 160ms 倒退收回
 * - 按滿 400ms（弧線 linear 畫滿）→ 輕觸、底色轉燒橙、1→1.08→1 → 不必放開，直接切到說一段
 *   並直接開始錄音（lib/say/hold-handoff：還按著就放開完成，已放開就點一下完成）
 * - 按住時手指滑出圓鈕 → 取消
 * - 讀螢幕：圓鈕名稱「記一筆」，另提供「說一段」連結，不必長按
 * - 提示只出現兩次：第一次打開；第三次「點一下」之後補一句「其實可以按住，直接說」
 *   只給登入者：訪客不出泡泡（會蓋住目錄，UX-28），也不記成看過，登入後才第一次出現
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSheetGuest } from "@/components/journal/log-sheet-provider";
import { beginHoldHandoff, cancelHoldHandoff } from "@/lib/say/hold-handoff";

export const LONG_PRESS_MS = 400;
/** 按住滿 120ms 才把＋換成麥克風（太短的點按不閃圖示） */
const ICON_SWAP_MS = 120;
/** 滿圈後放大 120＋回落 160，再切封面 */
const SWELL_MS = 280;
const HINT_KEY = "castflow.center-hint";
const HINT_TAP_THRESHOLD = 3;

type PressPhase = "idle" | "holding" | "armed";

const ARMED_LABEL = "開始說";
type HintState = { seen: boolean; taps: number; secondSeen: boolean };
type Hint = "first" | "second" | null;

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-paper)" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-paper)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function readHint(): HintState {
  try {
    const raw = window.localStorage.getItem(HINT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<HintState>) : {};
    return { seen: Boolean(parsed.seen), taps: Number(parsed.taps) || 0, secondSeen: Boolean(parsed.secondSeen) };
  } catch {
    // 讀不到（無痕等）就當看過，不打擾
    return { seen: true, taps: 0, secondSeen: true };
  }
}

function writeHint(state: HintState): void {
  try {
    window.localStorage.setItem(HINT_KEY, JSON.stringify(state));
  } catch {
    // 存不了不影響功能
  }
}

/** 首次提示與第三次點擊後的補充提示；點任何地方收起（泡泡本身不擋點擊，底下的列照常點得到） */
function useCenterHint(member: boolean): { hint: Hint; dismiss: () => void; countTap: () => void } {
  const [hint, setHint] = useState<Hint>(null);

  useEffect(() => {
    if (!member) return;
    const state = readHint();
    if (state.seen) return;
    writeHint({ ...state, seen: true });
    const timer = setTimeout(() => setHint("first"), 0);
    return () => clearTimeout(timer);
  }, [member]);

  const dismiss = useCallback(() => setHint(null), []);

  useEffect(() => {
    if (!hint) return;
    // 點在泡泡裡（「知道了」）交給按鈕自己的 onClick：pointerdown 就收起的話，觸控補發的 click 會落到泡泡底下的元素
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[role="tooltip"]')) return;
      dismiss();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [dismiss, hint]);

  const countTap = useCallback(() => {
    if (!member) return;
    const state = readHint();
    const taps = state.taps + 1;
    const showSecond = taps >= HINT_TAP_THRESHOLD && !state.secondSeen;
    writeHint({ ...state, taps, secondSeen: state.secondSeen || showSecond });
    if (showSecond) setHint("second");
  }, [member]);

  return { hint, dismiss, countTap };
}

function HintBubble({ hint, onDismiss }: { hint: Exclude<Hint, null>; onDismiss: () => void }) {
  return (
    <div
      role="tooltip"
      className="p4-inverse pointer-events-none absolute bottom-[calc(100%+14px)] left-1/2 flex w-[164px] -translate-x-1/2 flex-col gap-1 rounded-control bg-ink-950 px-3 py-2.5 text-paper"
    >
      {hint === "first" ? (
        <>
          <span className="text-caption">
            <b>點一下</b>　記一筆
          </span>
          <span className="text-caption">
            <b>按住</b>　馬上說一段
          </span>
        </>
      ) : (
        <span className="text-caption">其實可以按住，直接說</span>
      )}
      {/* 外觀 33×17，::before 撐到 ≥44×44（UX-19） */}
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto relative self-end text-eyebrow text-ember-soft before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']"
      >
        知道了
      </button>
      <span aria-hidden="true" className="absolute -bottom-[5px] left-1/2 -ml-[5px] block size-2.5 rotate-45 bg-ink-950" />
    </div>
  );
}

interface CenterPressButtonProps {
  onTap: () => void;
  onHold: () => void;
  /** 展示頁用：固定為長按中樣式 */
  demoPressed?: boolean;
}

export function CenterPressButton({ onTap, onHold, demoPressed = false }: CenterPressButtonProps) {
  const [phase, setPhase] = useState<PressPhase>(demoPressed ? "holding" : "idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showMic, setShowMic] = useState(demoPressed);
  // 還沒問到是不是訪客（null）也先不出，免得訪客閃一下
  const { hint, dismiss, countTap } = useCenterHint(useSheetGuest() === false);

  const clearTimer = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  useEffect(() => clearTimer, []);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPhase("holding");
    clearTimer();
    timerRef.current = [
      setTimeout(() => setShowMic(true), ICON_SWAP_MS),
      setTimeout(() => {
        setPhase("armed");
        navigator.vibrate?.(10);
        beginHoldHandoff();
      }, LONG_PRESS_MS),
      setTimeout(onHold, LONG_PRESS_MS + SWELL_MS),
    ];
  };

  const onPointerUp = () => {
    const released = phase;
    // 滿圈後放開不中斷：說一段照樣切過去
    if (released === "armed") return;
    clearTimer();
    setPhase("idle");
    setShowMic(false);
    if (released === "holding") {
      countTap();
      onTap();
    }
  };

  const cancel = () => {
    if (phase === "armed") cancelHoldHandoff();
    clearTimer();
    setPhase("idle");
    setShowMic(false);
  };

  /** 手指滑出圓鈕範圍 → 取消（pointer capture 下 pointerleave 不會觸發，改用座標判斷） */
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (phase === "idle") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const outside =
      event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) cancel();
  };

  /** 鍵盤（Enter／Space）觸發的 click：detail 為 0 → 記一筆 */
  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) onTap();
  };

  const pressing = phase !== "idle";
  const armed = phase === "armed";
  const circleTone = armed ? "p4-press-swell bg-ember" : pressing ? "translate-y-0.5 bg-ink-950" : "bg-ink-950";
  const label = armed ? ARMED_LABEL : pressing ? "繼續按住…" : "記一筆";

  return (
    <div className="relative -mt-8 flex flex-col items-center gap-[5px] justify-self-center">
      {hint ? <HintBubble hint={hint} onDismiss={dismiss} /> : null}
      <button
        type="button"
        aria-label="記一筆"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={cancel}
        onPointerMove={onPointerMove}
        onClick={onClick}
        onContextMenu={(event) => event.preventDefault()}
        className="relative block size-16 touch-none select-none [-webkit-touch-callout:none]"
      >
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" className="absolute -top-2 -left-2 -rotate-90">
          <circle cx="40" cy="40" r="37" fill="none" stroke={pressing ? "var(--color-ink-200)" : "transparent"} strokeWidth="3" />
          <circle
            cx="40"
            cy="40"
            r="37"
            fill="none"
            stroke="var(--color-ember)"
            strokeWidth="3"
            strokeLinecap="round"
            className={`press-ring ${pressing ? "press-ring-filling" : ""}`}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full transition-[translate,background-color] duration-[120ms,160ms] ease-standard ${circleTone} ${
            pressing || hint
              ? "shadow-[0_0_0_5px_var(--color-paper),0_0_0_7px_var(--color-ember)]"
              : "shadow-[0_0_0_5px_var(--color-paper),0_0_0_6px_var(--color-ink-200)]"
          }`}
        >
          {pressing && showMic ? <MicGlyph /> : <PlusIcon />}
        </span>
      </button>
      <span aria-hidden="true" className={`text-eyebrow font-bold tracking-[0.08em] ${pressing ? "text-ember-deep" : "text-ember-dark"}`}>
        {label}
      </span>
      <Link href="/say" className="sr-only">
        說一段
      </Link>
    </div>
  );
}
