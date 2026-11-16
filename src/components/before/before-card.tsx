/**
 * 散場之前①的一張卡：海報／字卡封面、標題、一行 meta、主鈕「排進行程」＋次鈕插槽（在哪看／去哪買票，由 WorkLinks 提供）。
 * Podcast 榜單走 PodcastPlanButton（先挑最新一集）、音樂榜單走 MusicPlanButton（先建專輯作品）；文化部活動有售票頁／活動頁就多一個往外開的連結。
 */

import { WorkCover } from "@/components/covers/work-cover";
import { OutArrow } from "@/components/links/link-parts";
import { cardMedia, type BeforeCard } from "@/lib/before/cards";
import { MusicPlanButton } from "./music-plan-button";
import { PlanButton } from "./plan-button";
import { PodcastPlanButton } from "./podcast-plan-button";

function coverKind(card: BeforeCard): string {
  return card.plan.type === "tmdb" ? card.plan.kind : card.placeholder;
}

function OutLink({ link, title }: { link: NonNullable<BeforeCard["link"]>; title: string }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${link.label}：${title}（另開視窗）`}
      className="inline-flex min-h-9 items-center gap-1 px-1 text-note font-bold text-ember-dark no-underline"
    >
      {link.label}
      <OutArrow size={12} />
    </a>
  );
}

/** 寬版（≥1024，Q-60 雛型 Before）：拿掉卡框、海報滿寬照比例，類別小字在片名上方 */
function wideCoverClass(card: BeforeCard): string {
  const media = cardMedia(card);
  return media === "podcast" || media === "music" ? "lg:aspect-square" : "lg:aspect-[2/3]";
}

/** className：寬版「全部」依欄數藏多的卡（trimClass） */
export function BeforeCardView({ card, secondary, tour, className = "" }: { card: BeforeCard; secondary?: React.ReactNode; tour?: string; className?: string }) {
  return (
    <article
      data-tour={tour}
      className={`p4-press flex min-w-0 flex-col gap-2 rounded-control border border-ink-950 p-2.5 lg:gap-0 lg:rounded-none lg:border-0 lg:p-0 ${className}`}
    >
      <WorkCover
        cover={{
          kind: coverKind(card),
          title: card.title,
          posterUrl: card.posterUrl,
          ...card.coverDetails,
        }}
        size="md"
        className={`h-[150px] w-full lg:h-auto ${wideCoverClass(card)}`}
      />
      <h3 className="m-0 font-serif-tc text-lede leading-[1.4] font-bold text-ink-950 lg:order-2 lg:mt-1 lg:text-section lg:leading-[1.35]">{card.title}</h3>
      <span className="text-eyebrow text-ink-600 tabular-nums lg:order-1 lg:mt-3 lg:text-caption lg:font-bold lg:tracking-[0.2em] lg:text-ember-dark">{card.meta}</span>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5 lg:order-3 lg:pt-3.5">
        {card.plan.type === "podcast" ? (
          <PodcastPlanButton plan={card.plan} />
        ) : card.plan.type === "music" ? (
          <MusicPlanButton plan={card.plan} />
        ) : (
          <PlanButton plan={card.plan} title={card.title} />
        )}
        {card.link ? <OutLink link={card.link} title={card.title} /> : null}
        {secondary}
      </div>
    </article>
  );
}
