/** 索引 › 作者：印章 40＋筆名（＋專欄名）＋「十二篇・最近一篇 10.08」，依最近一篇排列、不排名 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { authorPath } from "@/lib/authors/path";
import type { AuthorRow } from "@/lib/catalog/authors";
import { ChevronRight } from "./parts";

export function AuthorRows({ rows, total, showAll }: { rows: AuthorRow[]; total: number; showAll: boolean }) {
  if (rows.length === 0) {
    return <p className="m-0 px-4 pt-6 text-note leading-[1.8] text-ink-600">還沒有人以筆名發表。</p>;
  }
  return (
    <div className="px-4">
      <p className="m-0 pt-3.5 pb-1.5 text-caption text-ink-600">依最近一篇的時間排列。</p>
      {rows.map((row) => (
        <Link
          key={row.penName}
          href={authorPath(row.penName)}
          className="grid grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-x-3.5 border-b border-ink-200 py-3.5 text-inherit no-underline"
        >
          <PenSeal penName={row.penName} size={40} className="justify-self-center" />
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="flex min-w-0 items-baseline gap-2.5">
              <span className="max-w-full flex-none truncate font-serif-tc text-prose font-bold text-ink-950">{row.penName}</span>
              {row.columnName ? (
                <span data-testid="author-column-name" className="min-w-0 truncate text-caption text-ink-600">
                  {row.columnName}
                </span>
              ) : null}
            </span>
            <span className="text-caption text-ink-700 tabular-nums">{row.meta}</span>
          </span>
          <ChevronRight />
        </Link>
      ))}
      {!showAll && total > rows.length ? (
        <Link href="/catalog?tab=authors&all=1" className="flex min-h-12 items-center text-note font-bold text-ember-dark no-underline">
          看全部 {total} 位 →
        </Link>
      ) : null}
    </div>
  );
}
