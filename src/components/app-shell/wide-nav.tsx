"use client";

/**
 * 平板與桌機導航（設計稿「P4 斷點與排版規格」「P4 版面 Token」NAV 段）：
 * - 768–1023：左側細直欄 72（書脊：頂部直排 CastFlow），中央圓鈕留在底部中央浮動
 * - ≥1024：沒有底部導航；頂部一條髮絲線刊頭（刊名／散場之前／目錄／索引／日誌／我的），右側「記一筆｜說一段」文字鈕
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { mastheadIssueLine } from "@/lib/feed/masthead";
import { BeforeIcon, HomeIcon, IndexIcon, JournalIcon, MeIcon } from "./nav-icons";
import { type NavActiveItem, type WideNavItem } from "./nav-routes";

const RAIL_ICONS = { before: <BeforeIcon />, home: <HomeIcon />, index: <IndexIcon />, journal: <JournalIcon />, me: <MeIcon /> };

interface WideNavProps {
  items: readonly WideNavItem[];
  active: NavActiveItem;
  showDot: boolean;
  disabled: boolean;
}

function Dot() {
  return (
    <span className="absolute -top-0.5 -right-1 block size-[7px]">
      <span aria-hidden="true" className="p4-dot-ring absolute inset-0 block rounded-full border-[1.5px] border-ember" />
      <span className="p4-dot block size-full rounded-full bg-ember shadow-[0_0_0_2px_var(--color-paper)]" />
    </span>
  );
}

/** rail.item 71×68：圖示 22＋字 11；選中＝左緣 2×20 燒橙書籤 */
export function TabletRail({ items, active, showDot, disabled }: WideNavProps) {
  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-stretch border-r border-ink-200 bg-paper md:flex lg:hidden"
    >
      <Link href="/" aria-label="散場誌首頁" className="mx-3 mt-5 flex justify-center border-b border-ink-950 pb-3 no-underline">
        <span className="font-serif-tc text-lede font-bold tracking-[0.1em] text-ink-950 [writing-mode:vertical-rl]">散場誌</span>
      </Link>
      <div className="mt-6 flex flex-col">
        {items.map((item) => {
          const on = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={on ? "page" : undefined}
              aria-disabled={disabled || undefined}
              data-tour={item.key === "journal" ? "nav-journal" : undefined}
              className={`relative flex h-[68px] w-[71px] flex-col items-center justify-center gap-1 no-underline ${
                disabled ? "pointer-events-none text-ink-300" : on ? "text-ink-950" : "text-ink-600"
              }`}
            >
              {on ? <span aria-hidden="true" className="absolute top-1/2 left-0 -mt-2.5 block h-5 w-0.5 bg-ember" /> : null}
              <span className="relative block size-[22px]">
                {RAIL_ICONS[item.key]}
                {item.key === "me" && showDot ? <Dot /> : null}
              </span>
              <span className={`text-eyebrow ${on ? "font-bold" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PlusGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** 刊頭中央的期號行：用使用者當地時間，hydrate 後才算（避免伺服器時區不同造成不一致） */
function useIssueLine(): string | null {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setLine(mastheadIssueLine(new Date())), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return line;
}

/**
 * masthead：高 56（1024）／64（1280）；細刊頭列（Q-60 雛型）：髮絲線滿版、內容跟寬版容器對齊（上限 1360、左右 40）。
 * 目前分頁底線 inset 0 -2px ember 壓在刊頭線上；「說一段」是墨色膠囊鈕。
 * 目錄頁自己有大刊名與期號行，刊頭中央的期號行在目錄頁不重複。
 */
export function DesktopMasthead({ items, active, showDot, disabled, onLog }: WideNavProps & { onLog: () => void }) {
  const issueLine = useIssueLine();
  return (
    <header className="hidden border-b border-ink-950 lg:block">
      <div className="mx-auto grid h-14 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-stretch px-10 xl:h-16">
        <nav aria-label="主要導覽" className="flex items-stretch gap-7">
          <Link href="/" className="flex items-center font-serif-tc text-prose font-bold tracking-[0.2em] text-ink-950 no-underline">
            散場誌
          </Link>
          <div className="ml-1 flex items-stretch gap-6">
            {items.map((item) => {
              const on = active === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  aria-disabled={disabled || undefined}
                  data-tour={item.key === "journal" ? "nav-journal" : undefined}
                  className={`relative flex min-h-11 items-center text-note no-underline ${
                    disabled
                      ? "pointer-events-none text-ink-300"
                      : on
                        ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]"
                        : "text-ink-700"
                  }`}
                >
                  {item.label}
                  {item.key === "me" && showDot ? (
                    <span className="absolute top-3 -right-2.5">
                      <Dot />
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
        {/* 1024 放不下五個入口＋期號行：期號行 1280 起才出現 */}
        <span className="flex items-center text-eyebrow tracking-[0.14em] text-ink-600 tabular-nums">
          <span className="hidden xl:inline">{active === "home" ? null : issueLine}</span>
        </span>
        <div className="flex items-center justify-end gap-5">
          <button type="button" onClick={onLog} disabled={disabled} data-tour="center-button" className="flex min-h-11 items-center gap-1.5 bg-transparent text-note font-bold text-ink-950 disabled:text-ink-300">
            <PlusGlyph />
            記一筆
          </button>
          <Link href="/say" className="flex min-h-11 items-center gap-1.5 rounded-full bg-ink-950 px-[18px] text-note font-bold text-paper no-underline">
            <MicGlyph />
            說一段
          </Link>
        </div>
      </div>
    </header>
  );
}
