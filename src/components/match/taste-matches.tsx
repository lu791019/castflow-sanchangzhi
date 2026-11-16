/**
 * 散場之前「有人跟你看了同樣 N 部」（Q-40 A）：放在「你排好的」下方，前 3 人。
 * 露筆名、印章、專欄連結與共同作品名；寫的東西很像（Q-48）再加一行對方那篇標題。聯絡走專欄回信。沒有配到就整塊不顯示。
 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { authorPath } from "@/lib/authors/path";
import { matchHeading, matchReasons } from "@/lib/match/format";
import type { TasteMatch } from "@/lib/match/load";

export function TasteMatches({ matches }: { matches: TasteMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <section aria-labelledby="before-matches" data-testid="taste-matches" className="mt-6 flex flex-col">
      <div className="flex items-baseline justify-between border-b border-ink-950 pb-2">
        <h2 id="before-matches" className="m-0 font-serif-tc text-section font-bold text-ink-950 tabular-nums">
          {matchHeading(matches)}
        </h2>
      </div>
      {matches.map((match) => (
        <Link
          key={match.userId}
          href={authorPath(match.penName)}
          className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3.5 border-b border-ink-200 py-3.5 text-inherit no-underline"
        >
          <PenSeal penName={match.penName} size={40} className="justify-self-center" />
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="truncate font-serif-tc text-prose font-bold text-ink-950">{match.penName}</span>
            {matchReasons(match).map((reason) => (
              <span key={reason} className="truncate text-caption leading-[1.6] text-ink-700 tabular-nums">
                {reason}
              </span>
            ))}
          </span>
        </Link>
      ))}
    </section>
  );
}
