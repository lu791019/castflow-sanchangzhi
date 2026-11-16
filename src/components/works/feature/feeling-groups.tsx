/**
 * 所有感受依「本週／更早」分段（group.subhead）：明體 15 粗＋段數＋髮絲線＋日期。
 * 每列：印章 24＋筆名＋時間差署名、標題、摘要；匿名署名不露印章。
 * 零或一段時留「你的筆名」空位印（seal.placeholder，取代舊虛線圓頭像）。
 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { groupFeelings } from "@/lib/resonance/feature";
import type { FeatureFeeling } from "@/lib/resonance/feature-repository";
import { stripWorkTitle } from "@/lib/works/format";

/** 有本週時，更早只先露兩段；沒有本週露四段 */
const EARLIER_PREVIEW_WITH_WEEK = 2;
const EARLIER_PREVIEW_ALONE = 4;

interface FeelingGroupsProps {
  feelings: FeatureFeeling[];
  workTitle: string;
  weekStart: Date;
  now: Date;
}

function FeelingRow({ feeling, workTitle }: { feeling: FeatureFeeling; workTitle: string }) {
  return (
    <Link
      href={`/s/${feeling.shareSlug}`}
      className="flex flex-col gap-2 border-b border-ink-200 pt-[18px] pb-5 text-inherit no-underline"
      data-feeling={feeling.episodeId}
    >
      <div className="flex items-center gap-2.5">
        {feeling.penName ? <PenSeal penName={feeling.penName} size={24} /> : null}
        <span className="min-w-0 truncate text-note font-bold text-ink-950">{feeling.author}</span>
        <span className="flex-1" />
        <span className="text-eyebrow text-ink-600 tabular-nums">{feeling.signature}</span>
      </div>
      <span className="font-serif-tc text-prose leading-[1.55] font-bold text-ink-950">
        {stripWorkTitle(feeling.title, workTitle)}
      </span>
      {feeling.excerpt ? (
        <span className="line-clamp-3 text-note leading-[1.75] text-ink-700">{feeling.excerpt}</span>
      ) : null}
    </Link>
  );
}

function PlaceholderRow({ note }: { note: string }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 border-b border-dashed border-ink-300 py-5">
      <div className="flex items-center gap-2.5">
        <span className="box-border block size-6 flex-none rounded-[2px] border border-dashed border-ink-400" />
        <span className="flex-1 text-note text-ink-600">你的筆名</span>
        <span className="text-eyebrow text-ink-600">{note}</span>
      </div>
      <div className="mt-1.5 h-px w-[82%] bg-ink-200" />
      <div className="mt-2.5 h-px w-[56%] bg-ink-50" />
    </div>
  );
}

export function FeelingGroups({ feelings, workTitle, weekStart, now }: FeelingGroupsProps) {
  const groups = groupFeelings(feelings, weekStart, now);
  const hasWeek = groups.some((group) => group.key === "week");
  const earlierLimit = hasWeek ? EARLIER_PREVIEW_WITH_WEEK : EARLIER_PREVIEW_ALONE;
  const earlier = groups.find((group) => group.key === "earlier");
  const hiddenEarlier = earlier ? Math.max(0, earlier.items.length - earlierLimit) : 0;
  return (
    <section className={feelings.length === 0 ? "mt-11" : "mt-14"}>
      <div className="flex items-baseline justify-between border-b border-ink-950 pb-2.5">
        <h2 className="m-0 font-serif-tc text-section font-bold text-ink-950">{feelings.length} 段感受</h2>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">依發表時間</span>
      </div>

      {groups.map((group) => (
        <div key={group.key} data-feeling-group={group.key}>
          <div className="flex items-center gap-2.5 pt-[22px] pb-0.5">
            <span className="font-serif-tc text-lede font-bold tracking-[0.12em] text-ink-950">{group.label}</span>
            <span className="font-serif-tc text-note text-ink-600">{group.count}</span>
            <span aria-hidden="true" className="block h-px flex-1 bg-ink-200" />
            <span className="text-eyebrow tracking-[0.06em] text-ink-600 tabular-nums">{group.range}</span>
          </div>
          {(group.key === "earlier" ? group.items.slice(0, earlierLimit) : group.items).map((feeling) => (
            <FeelingRow key={feeling.episodeId} feeling={feeling} workTitle={workTitle} />
          ))}
        </div>
      ))}

      {hiddenEarlier > 0 ? (
        // TODO(works): 「讀更早的」分頁尚未實作，先只列出段數
        <span className="mt-1 inline-flex min-h-11 items-center text-note font-bold text-ink-600">
          還有更早的 {hiddenEarlier} 段（即將開放）
        </span>
      ) : null}

      {feelings.length <= 1 ? <PlaceholderRow note={feelings.length === 0 ? "現在" : "第二段的位置"} /> : null}
    </section>
  );
}
