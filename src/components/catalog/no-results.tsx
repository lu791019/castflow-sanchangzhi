"use client";

/** 索引搜尋無結果（設計稿「P3 索引 E」）：稿紙空格＋游標、換個寫法、記一筆 */

import Link from "next/link";
import { useLogSheet } from "@/components/journal/log-sheet-provider";
import { CATALOG_PATH } from "./masthead-switch";

export function NoResults({ query, tries }: { query: string; tries: string[] }) {
  const { openLogSheet } = useLogSheet();
  return (
    <div className="px-4 pt-7">
      <div
        aria-hidden="true"
        className="relative box-border h-[91px] border-b border-l border-ink-200 bg-[linear-gradient(var(--color-ink-200)_1px,transparent_1px),linear-gradient(90deg,var(--color-ink-200)_1px,transparent_1px)] bg-[length:30px_30px] bg-[position:right_top]"
      >
        <span className="absolute top-1.5 right-[13px] block h-[18px] w-0.5 bg-ember" />
      </div>
      <p className="mt-[22px] mb-0 font-serif-tc text-quote leading-[1.6] font-semibold text-ink-950">
        索引裡，還沒有
        <br />「{query}」。
      </p>
      <p className="mt-2.5 mb-0 text-note leading-[1.8] text-ink-700">
        可能還沒有人說過它。也可以換個寫法：片名的一部分、作者的筆名，或你記得的一句話。
      </p>
      {tries.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-[18px]">
          <span className="text-caption text-ink-600">試試</span>
          {tries.map((term) => (
            <Link
              key={term}
              href={`${CATALOG_PATH}?q=${encodeURIComponent(term)}`}
              className="flex min-h-11 items-center font-serif-tc text-lede text-ink-950 no-underline"
            >
              <span className="pb-0.5 shadow-[inset_0_-1px_0_var(--color-ink-950)]">{term}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt-[22px] flex flex-col gap-1.5 border-t border-ink-200 pt-[18px]">
        <span className="font-serif-tc text-prose font-bold text-ink-950">剛看完它？</span>
        <span className="text-note leading-[1.8] text-ink-700">記一筆，你就是第一個把它帶進這本刊物的人。</span>
        <button
          type="button"
          onClick={() => openLogSheet()}
          className="flex min-h-11 items-center self-start bg-transparent p-0 text-note font-bold text-ember-dark"
        >
          記一筆 →
        </button>
      </div>
    </div>
  );
}
