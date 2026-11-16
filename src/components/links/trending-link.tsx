/** 本週熱門每列的次鈕（只放次鈕，不打 DB）：上映中「訂票」、有直連「Netflix」、否則「在哪看」（TMDB 觀看頁） */

import { quickWatchLink } from "@/lib/links/quick-links";
import type { ScreenResult } from "@/lib/work-picker/types";
import { OutArrow } from "./link-parts";

export function TrendingLink({ item, section }: { item: ScreenResult; section: string }) {
  const link = quickWatchLink({ kind: item.kind, tmdbId: item.tmdbId, title: item.title, section });
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${item.title}：${link.label}`}
      className="flex min-h-11 items-center gap-1 pl-2 text-caption font-bold whitespace-nowrap text-ember-dark no-underline"
    >
      {link.label}
      <OutArrow size={12} />
    </a>
  );
}
