import { wavePath } from "@/lib/share/wave";

interface PullQuoteProps {
  quote: string;
  author?: string | null;
}

/** 正文中的引言：墨滴開引號 + 明體引文 + 聲波線 + 共鳴伏筆 */
export function PullQuote({ quote, author }: PullQuoteProps) {
  return (
    <aside className="my-9 text-left">
      <span
        aria-hidden="true"
        className="block h-[30px] font-serif-tc text-[56px] leading-[0.6] text-ember"
      >
        「
      </span>
      <p className="m-0 font-serif-tc text-quote leading-[1.65] font-semibold tracking-[0.02em] text-ink-950">
        {quote}
      </p>
      <div className="mt-3.5 h-3.5 w-[132px] overflow-hidden" aria-hidden="true">
        <svg width="200" height="14" viewBox="0 0 200 14" fill="none" className="block">
          <path
            className="share-wave-7s stroke-ember"
            strokeWidth="1.4"
            d={wavePath({ y: 7, amplitude: 6, halfPeriod: 15, width: 210 })}
          />
        </svg>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="text-caption tracking-[0.06em] text-ink-600">
          {author ? `— ${author}` : ""}
        </span>
      </div>
    </aside>
  );
}
