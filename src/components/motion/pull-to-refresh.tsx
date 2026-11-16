"use client";

/**
 * 〇九 下拉更新「翻到最新一頁」：把整疊刊物往下撥，刊頭下方露出一條稿紙格線。
 * 只有觸控、且已在頁頂時才接手；格線帶的高度＝內容位移（拖曳×0.5，上限 120），放開後 280ms 收回。
 * 減少動態：內容不跟手位移，格線帶固定 44px 淡入。
 */

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PULL_HOLD, PULL_SLOW_MS, pullOffset, pullPastThreshold } from "@/lib/motion/pull";

type Phase = "idle" | "dragging" | "refreshing";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [slow, setSlow] = useState(false);

  const onTouchStart = (event: React.TouchEvent) => {
    if (phase === "refreshing" || window.scrollY > 0) return;
    startY.current = event.touches[0].clientY;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = event.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setDrag(0);
      setPhase("idle");
      return;
    }
    setPhase("dragging");
    setDrag(delta);
  };

  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (!pullPastThreshold(drag)) {
      setDrag(0);
      setPhase("idle");
      return;
    }
    setPhase("refreshing");
    const slowTimer = window.setTimeout(() => setSlow(true), PULL_SLOW_MS);
    startTransition(async () => {
      router.refresh();
      await new Promise((resolve) => window.setTimeout(resolve, PULL_SLOW_MS));
      window.clearTimeout(slowTimer);
      setSlow(false);
      setDrag(0);
      setPhase("idle");
    });
  };

  const reduced = typeof window !== "undefined" && phase !== "idle" && prefersReducedMotion();
  const offset = phase === "refreshing" ? (slow ? PULL_HOLD : 0) : pullOffset(drag);
  const band = reduced ? PULL_HOLD : offset;
  const armed = phase === "refreshing" || pullPastThreshold(drag);
  const tracking = phase === "dragging";

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div
        aria-hidden={phase === "idle"}
        className={`p4-pull-band mx-4 flex items-end justify-center overflow-hidden ${tracking ? "" : "p4-pull-settle"}`}
        style={{ height: band }}
      >
        <span
          role={phase === "refreshing" ? "status" : undefined}
          className={`pb-2 text-eyebrow tracking-[0.2em] transition-colors duration-[120ms] ${armed ? "text-ember-dark" : "text-ink-600"}`}
        >
          {slow ? "翻頁中" : "翻到最新一頁"}
        </span>
      </div>
      {children}
    </div>
  );
}
