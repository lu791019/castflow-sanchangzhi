"use client";

/**
 * 〇一c 整理完成：細線收成一個實心句點，「校樣」標籤從圓鈕上方探出 0.8 秒再收回（像校樣從出紙口探出一角）。
 * 只在畫面上看得到的時候播；整理完成時不在前景就不補播。
 */

import { useEffect, useRef, useState } from "react";

/** 標籤進 160＋停 800＋收 160 */
const FLASH_MS = 1120;

export function useReadyFlash(readyEpisodeId: string | null): boolean {
  const [flashing, setFlashing] = useState(false);
  const previous = useRef(readyEpisodeId);

  useEffect(() => {
    const was = previous.current;
    previous.current = readyEpisodeId;
    if (!readyEpisodeId || was === readyEpisodeId || document.visibilityState !== "visible") return;
    const start = window.setTimeout(() => setFlashing(true), 0);
    const stop = window.setTimeout(() => setFlashing(false), FLASH_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [readyEpisodeId]);

  return flashing;
}

/** 圓鈕上方 8px 的「校樣」小標籤＋圓鈕中央 6px 句點（圓鈕以 -mt-8 浮出列外，座標以外框頂為 0） */
export function ReadyTag() {
  return (
    <>
      <span
        role="status"
        className="p4-ready-tag pointer-events-none absolute -top-[62px] left-1/2 z-10 -translate-x-1/2 rounded-[2px] border border-ember-dark bg-paper px-1.5 py-px text-caption font-bold tracking-[0.3em] whitespace-nowrap text-ember-dark"
      >
        校樣
      </span>
      <span aria-hidden="true" className="p4-dot pointer-events-none absolute -top-[3px] left-1/2 z-10 -ml-[3px] block size-1.5 rounded-full bg-ember" />
    </>
  );
}
