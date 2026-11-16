"use client";

/** 選了某天（點日期格、點「接下來」那筆）→ 捲到當天明細；減少動態時直接跳 */

import { useEffect, useRef } from "react";
import { dayAnchorId, scrollBehaviorFor, shouldScrollToDay } from "./day-scroll";

export function ScrollToDay({ day }: { day: string | null }) {
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const prev = previous.current;
    previous.current = day;
    if (!day || !shouldScrollToDay(prev, day)) return;
    const target = document.getElementById(dayAnchorId(day));
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: scrollBehaviorFor(reduced), block: "start" });
  }, [day]);

  return null;
}
