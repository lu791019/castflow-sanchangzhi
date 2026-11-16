import Link from "next/link";
import { WorkCover } from "@/components/covers/work-cover";
import { COVER_KIND, isSquareCategory } from "@/components/feed/feed-index";
import { CATEGORY_TAB_LABELS } from "@/lib/feed/categories";
import type { IndexWorkRow } from "@/lib/feed/index-column";
import { SHELF_COLUMNS, trimClass } from "@/lib/wide/layout";
import { WIDE_CONTAINER } from "./container";

/**
 * 寬版目錄「這週被說起的」海報架（雛型 Main）：取代窄版右欄索引，所以地標名稱一樣叫「索引」。
 * 一列排滿：1024 五部、1280 六部、1440 七部，多的用 CSS 藏（不量寬度）。
 */
export function WideShelf({ works, indexHref }: { works: IndexWorkRow[]; indexHref: string }) {
  return (
    <aside aria-label="索引" className={`${WIDE_CONTAINER} pt-14 pb-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-950 pb-2.5">
        <h2 className="m-0 font-serif-tc text-[28px] font-black tracking-[0.1em] text-ink-950">這週被說起的</h2>
        <Link href={indexHref} className="inline-flex min-h-11 items-center text-lede font-bold tracking-[0.12em] text-ember-dark no-underline">
          看索引 →
        </Link>
      </div>
      {works.length > 0 ? (
        <div className="mt-6 grid grid-cols-5 gap-7 xl:grid-cols-6 min-[90rem]:grid-cols-7">
          {works.map((work, index) => (
            <div key={work.title} className={`min-w-0 ${trimClass(index, SHELF_COLUMNS)}`}>
              <WorkCover
                cover={{ kind: COVER_KIND[work.category], title: work.title, posterUrl: work.posterUrl }}
                size="lg"
                className={`w-full ${isSquareCategory(work.category) ? "aspect-square" : "aspect-[2/3]"}`}
              />
              <span className="mt-2.5 line-clamp-2 font-serif-tc text-[18px] leading-[1.4] text-ink-900">{work.title}</span>
              <span className="block text-note text-ink-600 tabular-nums">
                {CATEGORY_TAB_LABELS[work.category]} · {work.count} 段
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
