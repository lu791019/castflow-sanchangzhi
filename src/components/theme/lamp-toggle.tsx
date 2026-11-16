"use client";

/**
 * 單集頁右上角「關燈」鈕（設計稿「P4 放映廳・切換規則」）：今晚的覆寫，不改設定。
 * aria-label 固定「關燈」，狀態用 aria-pressed；切換後 aria-live 念「已關燈／已開燈」。
 */

import { useState } from "react";
import { useTheme } from "./theme-provider";

function LampIcon({ lit }: { lit: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5v4.5" />
      <path d="M5.5 14a6.5 6.5 0 0 1 13 0z" />
      <path d="M10.5 14a1.5 1.5 0 0 0 3 0" />
      {lit ? <path d="M12 18v2.5M7.4 17.2l-1.5 1.6M16.6 17.2l1.5 1.6" /> : null}
    </svg>
  );
}

export function LampToggle() {
  const { resolved, toggleLamp } = useTheme();
  const [announce, setAnnounce] = useState("");
  const off = resolved === "screen";

  const onClick = () => {
    const next = toggleLamp();
    setAnnounce(next === "screen" ? "已關燈" : "已開燈");
  };

  return (
    <>
      <button
        type="button"
        aria-label="關燈"
        aria-pressed={off}
        onClick={onClick}
        className={`relative -mr-2.5 flex size-11 items-center justify-center bg-transparent p-0 ${off ? "text-ink-900" : "text-ink-950"}`}
      >
        <LampIcon lit={!off} />
        {off ? <span aria-hidden="true" className="absolute bottom-1.5 left-4 block h-0.5 w-3 bg-ember" /> : null}
      </button>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </>
  );
}
