"use client";

/**
 * 索引搜尋列：打字 300ms 後換網址（伺服器重算結果），也能按 Enter 送出（沒有 JS 時走表單 GET）。
 * 清除鈕回到原本的分頁。
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATALOG_PATH } from "./masthead-switch";

const DEBOUNCE_MS = 300;
const MAX_LENGTH = 40;

function SearchGlyph() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="flex-none text-ink-700">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function CatalogSearchBox({ initialQuery, tab }: { initialQuery: string; tab: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [lastPushed, setLastPushed] = useState(initialQuery);
  const [prevInitial, setPrevInitial] = useState(initialQuery);

  // 網址被別處改了（「試試」連結、上一頁）：輸入框跟著換；自己打字推上去的不覆蓋，免得吃掉正在打的字
  if (initialQuery !== prevInitial) {
    setPrevInitial(initialQuery);
    if (initialQuery !== lastPushed) {
      setValue(initialQuery);
      setLastPushed(initialQuery);
    }
  }

  useEffect(() => {
    const query = value.trim();
    if (query === lastPushed) return;
    const timer = window.setTimeout(() => {
      setLastPushed(query);
      const params = new URLSearchParams(query ? { q: query } : tab === "works" ? {} : { tab });
      const search = params.toString();
      router.replace(search ? `${CATALOG_PATH}?${search}` : CATALOG_PATH, { scroll: false });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, lastPushed, tab, router]);

  return (
    <form
      action={CATALOG_PATH}
      method="get"
      role="search"
      className={`mx-4 flex h-12 items-center gap-2.5 border-b border-ink-950 ${initialQuery ? "mt-3" : "mt-5"}`}
    >
      <SearchGlyph />
      <label htmlFor="catalog-q" className="sr-only">
        搜尋索引
      </label>
      <input
        id="catalog-q"
        name="q"
        type="search"
        enterKeyHint="search"
        maxLength={MAX_LENGTH}
        placeholder="作品、作者、一句話……"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 font-serif-tc text-prose text-ink-950 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="清除搜尋"
          onClick={() => setValue("")}
          className="-mr-3 flex size-11 items-center justify-center bg-transparent text-ink-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </form>
  );
}
