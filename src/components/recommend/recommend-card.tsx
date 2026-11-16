/** 「你可能會想看」的一張卡：沿用散場之前卡片（WorkCover、標題、meta）＋一句理由、「排進行程」與在哪看／去哪買票 */

import { PlanButton } from "@/components/before/plan-button";
import { WorkCover } from "@/components/covers/work-cover";
import { OutArrow } from "@/components/links/link-parts";
import type { Recommendation } from "@/lib/recommend/types";

export function RecommendCardView({ item }: { item: Recommendation }) {
  const { card, link } = item.candidate;
  const coverKind = card.plan?.type === "tmdb" ? card.plan.kind : item.candidate.media === "podcast" ? "podcast_episode" : card.placeholder;
  return (
    // 寬版邊欄（≥1024，Q-60）：一列一張，縮圖在左、字在右，片名不再擠成兩三字一行
    <article className="p4-press flex min-w-0 flex-col gap-2 rounded-control border border-ink-950 p-2.5 lg:grid lg:grid-cols-[72px_minmax(0,1fr)] lg:content-start lg:gap-x-4 lg:gap-y-1 lg:rounded-none lg:border-0 lg:border-b lg:border-ink-200 lg:px-0 lg:py-4">
      <WorkCover
        cover={{ kind: coverKind, title: card.title, posterUrl: card.posterUrl, ...card.coverDetails }}
        size="md"
        className="h-[150px] w-full lg:row-span-4 lg:h-[108px] lg:w-[72px]"
      />
      <h3 className="m-0 font-serif-tc text-lede leading-[1.4] font-bold text-ink-950 lg:text-[18px]">{card.title}</h3>
      <span className="text-eyebrow text-ink-600 tabular-nums lg:text-caption">{card.meta}</span>
      <p className="m-0 text-caption leading-[1.6] font-bold text-ember-dark">{item.reason}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5 lg:mt-1">
        {card.plan ? <PlanButton plan={card.plan} title={card.title} /> : null}
        {link ? (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${card.title}：${link.label}`}
            className="hit-44 inline-flex min-h-9 items-center gap-1 px-1 text-caption font-bold whitespace-nowrap text-ember-dark no-underline"
          >
            {link.label}
            <OutArrow size={12} />
          </a>
        ) : null}
      </div>
    </article>
  );
}
