/**
 * 「這週散場的人」（P3 作品特輯 A，cast.row）：同一作品本週說過一段的人，印章 40、五欄等分，
 * 超過十人以「和另外 N 人」收合；下方「散場語錄・每人一句」取各自文章的引言。本週沒有人就整區不出現。
 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { authorPath } from "@/lib/authors/path";
import type { CastMember } from "@/lib/resonance/feature";
import { dayLabel, formatDayRange } from "@/lib/resonance/week";
import { normalizeQuote } from "@/lib/works/resonance";

const CAST_ROW_MAX = 10;

interface CastSectionProps {
  cast: CastMember[];
  weekStart: Date;
  now: Date;
  /** 「《海街日記》」 */
  workName: string;
  verb: "看" | "聽";
}

export function CastSection({ cast, weekStart, now, workName, verb }: CastSectionProps) {
  if (cast.length === 0) return null;
  const shown = cast.slice(0, CAST_ROW_MAX);
  const hidden = cast.length - shown.length;
  const quotes = shown.filter((member) => member.pullQuote);
  return (
    <section className="mt-14" aria-labelledby="cast-heading">
      <div className="flex items-baseline justify-between">
        <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">同場</span>
        <span className="text-eyebrow tracking-[0.08em] text-ink-600 tabular-nums">
          {formatDayRange(weekStart, now, " – ")}
        </span>
      </div>
      <h2 id="cast-heading" className="mt-2 mb-0 font-serif-tc text-section font-bold text-ink-950">
        這週散場的人
      </h2>
      <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">
        這一週，有 {cast.length} 個人{verb}完{workName}，也各自說了一段。
      </p>
      <div className="mt-4 grid grid-cols-5 gap-y-4 border-t border-b border-t-ink-950 border-b-ink-200 pt-4 pb-3">
        {shown.map((member) => (
          <Link
            key={member.userId}
            href={authorPath(member.penName)}
            aria-label={`讀${member.penName}的專欄`}
            className="flex min-h-11 flex-col items-center gap-1.5 no-underline"
          >
            <PenSeal penName={member.penName} size={40} />
            <span className="max-w-full truncate text-caption font-bold text-ink-950">{member.penName}</span>
            <span className="text-eyebrow text-ink-600 tabular-nums">{dayLabel(new Date(member.saidAt))}</span>
          </Link>
        ))}
      </div>
      {hidden > 0 ? (
        <p className="mt-2 mb-0 text-right text-caption text-ink-600">和另外 {hidden} 人</p>
      ) : null}
      {quotes.length > 0 ? (
        <>
          <span className="mt-[18px] block text-eyebrow font-bold tracking-[0.24em] text-ink-600">散場語錄・每人一句</span>
          <div className="mt-1 flex flex-col">
            {quotes.map((member) => (
              <Link
                key={member.userId}
                href={`/s/${member.shareSlug}`}
                className="flex flex-col gap-1 border-b border-ink-200 pt-3.5 pb-3 text-inherit no-underline"
              >
                <span className="font-serif-tc text-lede leading-[1.8] tracking-[0.02em] text-ink-700">
                  <span className="text-ember">「</span>
                  {normalizeQuote(member.pullQuote ?? "")}
                  <span className="text-ember">」</span>
                </span>
                <span className="text-right text-caption text-ink-600">——{member.penName}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
