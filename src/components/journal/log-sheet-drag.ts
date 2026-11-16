/**
 * 記一筆 sheet 拖曳跟手（Q-44 C）：抓把手／標題列往下拖，sheet 跟著手指走；
 * 放開時拖超過 120px（或快速往下甩）就收起，否則沿 spring 曲線回彈。
 * 只綁 sheet 頂端（不綁可捲動的內容區），避免和捲動、iPhone 返回手勢打架。
 */

import { useRef, useState } from "react";

export const DISMISS_DISTANCE = 120;
/** 甩：放開前的速度（px/ms）夠快，且至少拖了一小段 */
const FLICK_VELOCITY = 0.6;
const FLICK_MIN_DISTANCE = 40;

export type DragOutcome = "dismiss" | "settle";

/** 往下拖的位移；往上拖不動 */
export function dragOffset(startY: number, currentY: number): number {
  return Math.max(0, currentY - startY);
}

export function dragRelease(offset: number, velocity: number): DragOutcome {
  if (offset > DISMISS_DISTANCE) return "dismiss";
  if (offset > FLICK_MIN_DISTANCE && velocity >= FLICK_VELOCITY) return "dismiss";
  return "settle";
}

interface Sample {
  y: number;
  t: number;
}

interface DragSession {
  startY: number;
  prev: Sample;
  last: Sample;
}

export interface SheetDrag {
  offset: number;
  dragging: boolean;
  handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
}

/** 按在按鈕、連結、輸入框上不算拖（讓「關閉」照常點得到） */
function startsOnControl(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select"));
}

export function useSheetDrag({ enabled, onDismiss }: { enabled: boolean; onDismiss: () => void }): SheetDrag {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const session = useRef<DragSession | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0 || startsOnControl(event.target)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const sample = { y: event.clientY, t: event.timeStamp };
    session.current = { startY: event.clientY, prev: sample, last: sample };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (!current) return;
    session.current = { ...current, prev: current.last, last: { y: event.clientY, t: event.timeStamp } };
    setOffset(dragOffset(current.startY, event.clientY));
  };

  const finish = (outcome: DragOutcome) => {
    session.current = null;
    setDragging(false);
    if (outcome === "dismiss") {
      onDismiss();
      return;
    }
    setOffset(0);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (!current) return;
    const elapsed = Math.max(1, event.timeStamp - current.prev.t);
    const velocity = (event.clientY - current.prev.y) / elapsed;
    finish(dragRelease(dragOffset(current.startY, event.clientY), velocity));
  };

  return { offset, dragging, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => finish("settle") } };
}
