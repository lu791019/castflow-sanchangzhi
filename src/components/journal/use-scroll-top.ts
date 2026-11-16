"use client";

import { useEffect, useRef } from "react";

/** 選了場外（演出／展覽）：第一段換成手寫表單，捲回最上面讓人看到（UX-17）；開 sheet 當下不捲 */
export function useScrollTopOnLive(isLive: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLive = useRef(isLive);
  useEffect(() => {
    if (isLive && !wasLive.current) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      scrollRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
    wasLive.current = isLive;
  }, [isLive]);
  return scrollRef;
}
