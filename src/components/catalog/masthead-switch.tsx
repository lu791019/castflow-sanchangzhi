/**
 * 刊頭右上「目錄｜索引」兩個文字鈕（Token「entry.index」：44×52）。
 * 選中＝inset 0 -2px ember，底線貼齊刊頭 1px 墨線（masthead.index.current）。底部導航不新增分頁。
 */

import Link from "next/link";
import { FEED_PATH } from "@/components/app-shell/nav-routes";

export const CATALOG_PATH = "/catalog";

const ITEMS = [
  { key: "feed", label: "目錄", href: FEED_PATH },
  { key: "catalog", label: "索引", href: CATALOG_PATH },
] as const;

export function MastheadSwitch({ current, className = "" }: { current: "feed" | "catalog"; className?: string }) {
  return (
    <nav aria-label="首頁切換" className={`-mr-1 flex items-stretch gap-3.5 self-stretch ${className}`}>
      {ITEMS.map((item) => {
        const on = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-[52px] min-w-11 items-center justify-center text-note tracking-[0.12em] no-underline ${
              on ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
