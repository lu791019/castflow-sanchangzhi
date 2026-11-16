/** 索引搜尋結果（index.result）：作品列 48×72 海報、作者列印 40、文章列明體 17＋印 24；全部以髮絲線分隔 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import type { SearchResults } from "@/lib/catalog/results";
import { WorkCover } from "@/components/covers/work-cover";
import { isSquareCover, type WorkKind } from "@/lib/works/format";
import { ChevronRight, Highlighted } from "./parts";

function Summary({ results }: { results: SearchResults }) {
  const groups = [
    { label: "作品", count: results.works.length },
    { label: "作者", count: results.authors.length },
    { label: "文章", count: results.articles.length },
  ];
  return (
    <p className="m-0 flex items-baseline gap-3.5 border-b border-ink-950 pt-3.5 pb-2.5 text-caption tracking-[0.08em]">
      {groups.map((group) => (
        <span key={group.label} className={group.count ? "text-ink-950" : "text-ink-600"}>
          {group.label} <span className="font-serif-tc font-bold">{group.count}</span>
        </span>
      ))}
    </p>
  );
}

export function SearchResultList({ results, query }: { results: SearchResults; query: string }) {
  return (
    <div className="px-4">
      <Summary results={results} />
      {results.works.map((work) => (
        <Link
          key={work.key}
          href={work.href}
          className="grid grid-cols-[48px_minmax(0,1fr)_16px] items-center gap-x-3.5 border-b border-ink-200 py-4 text-inherit no-underline"
        >
          <WorkCover cover={{ kind: work.coverKind, title: work.coverTitle, posterUrl: work.posterUrl }} size={isSquareCover({ kind: work.coverKind as WorkKind }) ? "xs" : "sm"} className={isSquareCover({ kind: work.coverKind as WorkKind }) ? "size-12" : "h-[72px] w-12"} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-eyebrow font-bold tracking-[0.2em] text-ember-dark">{work.eyebrow}</span>
            <span className="font-serif-tc text-prose leading-[1.5] font-bold text-ink-950">
              <Highlighted parts={work.titleParts} />
            </span>
            <span className="text-caption text-ink-600 tabular-nums">{work.meta}</span>
          </span>
          <ChevronRight />
        </Link>
      ))}
      {results.authors.map((author) => (
        <Link
          key={author.penName}
          href={author.href}
          className="grid grid-cols-[48px_minmax(0,1fr)_16px] items-center gap-x-3.5 border-b border-ink-200 py-3.5 text-inherit no-underline"
        >
          <PenSeal penName={author.penName} size={40} className="justify-self-center" />
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-eyebrow font-bold tracking-[0.2em] text-ink-600">作者</span>
            <span className="font-serif-tc text-prose font-bold text-ink-950">
              <Highlighted parts={author.titleParts} />
            </span>
            <span className="truncate text-caption text-ink-600 tabular-nums">{author.meta}</span>
          </span>
          <ChevronRight />
        </Link>
      ))}
      {results.articles.map((article) => (
        <Link
          key={article.key}
          href={article.href}
          className="flex flex-col gap-2 border-b border-ink-200 pt-4 pb-[18px] text-inherit no-underline"
        >
          <span className="text-eyebrow font-bold tracking-[0.2em] text-ink-600">{article.eyebrow}</span>
          <span className="font-serif-tc text-prose leading-[1.55] font-bold text-ink-950">
            <Highlighted parts={article.titleParts} />
          </span>
          {article.snippetParts ? (
            <span className="pl-2.5 font-serif-tc text-note leading-[1.75] text-ink-700 shadow-[inset_2px_0_0_var(--color-ink-200)]">
              <Highlighted parts={article.snippetParts} />
            </span>
          ) : null}
          <span className="flex items-center gap-2">
            <PenSeal penName={article.penName} size={24} />
            <span className="text-caption font-bold text-ink-950">{article.penName}</span>
            <span className="text-eyebrow text-ink-600 tabular-nums">{article.date}</span>
          </span>
        </Link>
      ))}
      <p className="m-0 py-4 text-caption leading-[1.7] text-ink-600">
        也會比對文章裡的句子。畫線的地方，就是找到「{query}」的位置。
      </p>
    </div>
  );
}
