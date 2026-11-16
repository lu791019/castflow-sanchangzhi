import Link from "next/link";
import { WorkCover } from "@/components/covers/work-cover";
import { CATEGORY_TAB_LABELS, type FeedCategory } from "@/lib/feed/categories";
import type { IndexColumnRow, IndexWorkRow } from "@/lib/feed/index-column";

/** 縮圖字卡樣式跟著分類；Podcast、音樂是方形封面 */
export const COVER_KIND: Record<FeedCategory, string> = {
  screen: "movie",
  podcast: "podcast",
  music: "music",
  live: "live",
  exhibition: "exhibition",
  essay: "essay",
};

export function isSquareCategory(category: FeedCategory): boolean {
  return category === "podcast" || category === "music";
}

/** 桌機／平板目錄右欄「索引」：欄目＋這週被說起的（不放按鈕群、不放統計、不放推薦流） */

function IndexHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink-950 pb-2">
      <h3 className="m-0 font-serif-tc text-prose font-bold text-ink-950">{title}</h3>
      {aside ? <span className="text-eyebrow text-ink-600">{aside}</span> : null}
    </div>
  );
}

export function FeedIndexColumn({ columns, works }: { columns: IndexColumnRow[]; works: IndexWorkRow[] }) {
  return (
    <aside aria-label="索引" className="flex flex-col gap-9">
      <div className="flex items-baseline justify-between">
        <span className="text-eyebrow font-bold tracking-[0.2em] text-ember-dark">索引</span>
        <span className="text-eyebrow tracking-[0.2em] text-ink-600">INDEX</span>
      </div>
      {columns.length > 0 ? (
        <section className="-mt-5">
          <IndexHead title="欄目" />
          {columns.map((row) => (
            <Link
              key={row.key}
              href={row.href}
              className="flex min-h-[45px] items-center justify-between border-b border-ink-200 text-inherit no-underline"
            >
              <span className="font-serif-tc text-lede text-ink-950">{row.label}</span>
              <span className="text-caption text-ink-600 tabular-nums">今晚 {row.count}</span>
            </Link>
          ))}
        </section>
      ) : null}
      {works.length > 0 ? (
        <section>
          <IndexHead title="這週被說起的" />
          {works.map((work) => (
            <div key={work.title} className="flex min-h-[73px] items-center gap-3 border-b border-ink-200">
              <WorkCover
                cover={{ kind: COVER_KIND[work.category], title: work.title, posterUrl: work.posterUrl }}
                size="xs"
                className={isSquareCategory(work.category) ? "size-8" : "h-12 w-8"}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-serif-tc text-lede font-bold text-ink-950">{work.title}</span>
                <span className="text-eyebrow text-ink-600">
                  {CATEGORY_TAB_LABELS[work.category]}・{work.count} 段
                </span>
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </aside>
  );
}
