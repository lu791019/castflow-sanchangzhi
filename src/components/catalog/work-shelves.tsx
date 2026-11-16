/** 索引 › 作品：類型分段橫向書架（index.shelf：72×108、間距 12、右側出血 16 暗示可橫捲） */

import Link from "next/link";
import type { Shelf } from "@/lib/catalog/shelves";
import { WorkCover } from "@/components/covers/work-cover";

/** 各類別封面比例統一（Q-61）：Podcast、音樂 1:1（72×72），影劇 2:3（72×108），演出圓章、展覽細框走字卡樣式 */
function isSquareShelf(kind: string): boolean {
  return kind === "podcast" || kind === "podcast_episode" || kind === "music";
}

/** 方形 72×72 放不下 md 字卡的五字直排（會切到），改用 sm（每欄四字） */
function coverLayout(kind: string): { size: "sm" | "md"; className: string } {
  return isSquareShelf(kind) ? { size: "sm", className: "size-[72px]" } : { size: "md", className: "h-[108px] w-[72px]" };
}

export function WorkShelves({ shelves, fullKind }: { shelves: Shelf[]; fullKind: string | null }) {
  if (shelves.length === 0) {
    return <p className="m-0 px-4 pt-6 text-note leading-[1.8] text-ink-600">還沒有人說過任何作品。記一筆，你就是第一個。</p>;
  }
  return (
    <div className="px-4">
      {shelves.map((shelf) => {
        const expanded = fullKind === shelf.kind;
        return (
          <section key={shelf.kind} className="pt-5" aria-labelledby={`shelf-${shelf.kind}`}>
            <div className="flex items-center gap-0.5 border-b border-ink-200">
              <h2 id={`shelf-${shelf.kind}`} className="m-0 font-serif-tc text-prose font-bold text-ink-950">
                {shelf.label}
              </h2>
              <span className="font-serif-tc text-note text-ink-600">・{shelf.countLabel}</span>
              <span className="flex-1" />
              {shelf.total > shelf.items.length || expanded ? (
                <Link
                  href={expanded ? "/catalog" : `/catalog?kind=${shelf.kind}`}
                  aria-label={expanded ? `收起${shelf.label}` : `全部${shelf.label}`}
                  className="flex min-h-11 items-center text-caption text-ink-700 no-underline"
                >
                  {expanded ? "收起 ‹" : "全部 ›"}
                </Link>
              ) : (
                <span className="min-h-11" />
              )}
            </div>
            <div
              className={
                expanded
                  ? "mt-3 grid grid-cols-[repeat(auto-fill,72px)] justify-between gap-x-3 gap-y-4"
                  : "-mr-4 mt-3 flex gap-3 overflow-x-auto pr-4 [scrollbar-width:none]"
              }
            >
              {shelf.items.map((item) => (
                <Link key={item.key} href={item.href} className="flex w-[72px] flex-none flex-col gap-1.5 text-inherit no-underline">
                  <WorkCover
                    cover={{ kind: item.coverKind, title: item.plate || item.title, posterUrl: item.posterUrl }}
                    size={coverLayout(item.coverKind).size}
                    mark={item.mark}
                    className={coverLayout(item.coverKind).className}
                  />
                  <span className="truncate font-serif-tc text-note leading-[1.4] font-bold text-ink-950">{item.title}</span>
                  <span className="-mt-1 text-eyebrow text-ink-600 tabular-nums">{item.countLabel}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
