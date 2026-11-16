import Link from "next/link";
import { WorkCardPoster } from "./work-card-poster";

interface WorkCardProps {
  title: string;
  posterUrl?: string | null;
  posterCredit?: string | null;
  metaLines?: string[];
  sideLabel?: string | null;
  /** 有綁定作品時連到作品特輯 */
  href?: string | null;
}

/** 來源作品卡：有海報時圖在右側出血；無海報時以直排片名撐起字卡（空狀態） */
export function WorkCard({
  title,
  posterUrl,
  posterCredit,
  metaLines = [],
  sideLabel,
  href,
}: WorkCardProps) {
  const card = renderCard({ title, posterUrl, posterCredit, metaLines, sideLabel });
  if (!href) return card;
  return (
    <Link
      href={href}
      aria-label={`《${title}》作品特輯`}
      className="group block text-inherit no-underline"
    >
      {card}
      <span className="mt-2 flex justify-end text-caption font-bold tracking-[0.1em] text-ember-dark group-hover:text-ember-deep">
        看作品特輯 →
      </span>
    </Link>
  );
}

function renderCard({
  title,
  posterUrl,
  posterCredit,
  metaLines = [],
  sideLabel,
}: Omit<WorkCardProps, "href">) {
  const typeCard = <TypeCardFigure title={title} metaLines={metaLines} sideLabel={sideLabel} />;
  if (!posterUrl) return typeCard;
  return (
    <WorkCardPoster title={title} posterUrl={posterUrl} posterCredit={posterCredit} metaLines={metaLines} fallback={typeCard} />
  );
}

/** 無海報（或海報載入失敗）：直排片名撐起字卡 */
function TypeCardFigure({ title, metaLines, sideLabel }: { title: string; metaLines: string[]; sideLabel?: string | null }) {
  return (
    <figure className="mt-8 mb-0 flex h-[250px] items-end gap-3.5">
      <figcaption className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span className="text-eyebrow tracking-[0.2em] text-ember-dark">
          圖 · 作品
        </span>
        <span className="font-serif-tc text-[18px] leading-[1.35] font-bold text-ink-950">
          {title}
        </span>
        {metaLines.map((line) => (
          <span key={line} className="text-caption leading-[1.7] text-ink-700">
            {line}
          </span>
        ))}
      </figcaption>
      <div
        data-testid="work-card-plate"
        className="box-border flex h-[250px] w-[166px] flex-none justify-between border-t-2 border-b border-ink-950 bg-paper-2 pt-4 pr-3.5 pb-3.5 pl-3.5"
      >
        <div className="flex flex-col justify-between">
          {sideLabel ? (
            <span className="text-[10px] tracking-[0.2em] text-ink-600 [writing-mode:vertical-rl]">
              {sideLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="block size-2 bg-ember" />
        </div>
        <span className="font-serif-tc text-[44px] leading-[1.1] font-bold tracking-[0.08em] text-ink-950 [writing-mode:vertical-rl]">
          {title}
        </span>
      </div>
    </figure>
  );
}
