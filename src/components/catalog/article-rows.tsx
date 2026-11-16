/** 文章列（雜誌目錄語彙，沿用「我的 › 發表過的感受」列樣式）：日期欄＋明體標題＋欄目・《作品》 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import type { ArticleRowItem } from "@/lib/catalog/types";

export function ArticleRows({ rows, showAuthor }: { rows: ArticleRowItem[]; showAuthor: boolean }) {
  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <Link
          key={row.key}
          href={row.href}
          className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-2 border-b border-ink-200 py-4 text-inherit no-underline active:bg-paper-2"
        >
          <span className="pt-0.5 font-serif-tc text-note text-ink-600 tabular-nums">{row.date}</span>
          <span className="flex min-w-0 flex-col gap-[5px]">
            <span className="font-serif-tc text-prose leading-[1.5] font-bold text-ink-950">{row.title}</span>
            <span className="text-caption text-ink-600">
              <span className="text-ember-dark">{row.columnName}</span>
              {row.workTitle ? ` · 《${row.workTitle}》` : null}
            </span>
            {showAuthor ? (
              <span className="mt-0.5 flex items-center gap-2">
                <PenSeal penName={row.penName} size={24} />
                <span className="text-caption font-bold text-ink-950">{row.penName}</span>
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  );
}
