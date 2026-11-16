/**
 * 文章頁尾「這週也看了《X》的人」（P3 文章頁 A）：印章 40、五欄等分、≤8 位依說出來的時間排；
 * 點印章連作者專欄。沒有人就整區不顯示。
 */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { authorPath } from "@/lib/authors/path";
import { sameShowNote, type CastMember } from "@/lib/resonance/feature";
import { dayLabel, formatDayRange, lastSevenDaysStart } from "@/lib/resonance/week";

interface SameShowSectionProps {
  people: CastMember[];
  /** 「《海街日記》」（含書名號） */
  workName: string;
  workKind: string;
  verb: "看" | "聽";
  now: Date;
}

export function SameShowSection({ people, workName, workKind, verb, now }: SameShowSectionProps) {
  if (people.length === 0) return null;
  return (
    <section aria-labelledby="same-show-heading" className="mx-4 mt-11">
      <div className="flex items-baseline justify-between gap-2 border-t border-ink-950 pt-3">
        <h2 id="same-show-heading" className="m-0 font-serif-tc text-[17px] font-bold text-ink-950">
          這週也{verb}了{workName}的人
        </h2>
        <span className="text-eyebrow whitespace-nowrap text-ink-600 tabular-nums">
          {formatDayRange(lastSevenDaysStart(now), now, "–")}
        </span>
      </div>
      <p className="mt-1.5 mb-0 text-caption leading-[1.7] text-ink-600">{sameShowNote(workKind)}</p>
      <div className="mt-[18px] grid grid-cols-5 gap-y-3">
        {people.map((person) => (
          <Link
            key={person.userId}
            href={authorPath(person.penName)}
            aria-label={`讀${person.penName}的專欄`}
            className="flex min-h-11 flex-col items-center gap-1.5 py-0.5 no-underline"
          >
            <PenSeal penName={person.penName} size={40} />
            <span className="flex flex-col items-center gap-px">
              <span className="max-w-full truncate text-caption text-ink-800">{person.penName}</span>
              <span className="text-eyebrow text-ink-600 tabular-nums">{dayLabel(new Date(person.saidAt))} 說的</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
