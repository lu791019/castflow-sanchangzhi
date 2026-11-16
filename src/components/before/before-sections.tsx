/** 散場之前三個區塊（雛型版本二）：① 這週上映・開演・開展 → ② 你排好的 → ③ 有人說了 */

import Link from "next/link";
import { FEED_PATH } from "@/components/app-shell/nav-routes";
import { ListEntry } from "@/components/feed/feed-entries";
import { UpcomingRow } from "@/app/(social)/journal/journal-rows";
import type { ThisWeekView } from "@/lib/before/load";
import type { FeedEntry } from "@/lib/feed/entries";
import type { JournalViewEntry } from "@/lib/journal/view";
import { ThisWeekSection } from "./this-week-section";

export { NO_LIVE_COPY } from "./this-week-section";

function SectionHead({ id, title, aside }: { id: string; title: string; aside: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink-950 pb-2">
      <h2 id={id} className="m-0 font-serif-tc text-section font-bold text-ink-950">
        {title}
      </h2>
      <span className="text-eyebrow text-ink-600">{aside}</span>
    </div>
  );
}

/** ① 這週上映・開演・開展：換縣市要能直接換畫面，整區在 client（this-week-section.tsx） */
export function ThisWeek(props: ThisWeekView) {
  return <ThisWeekSection initial={props} />;
}

export function YourPlans({ entries }: { entries: JournalViewEntry[] }) {
  return (
    <section aria-labelledby="before-plans" className="mt-6 flex flex-col">
      <SectionHead id="before-plans" title="你排好的" aside="當天早上會提醒你" />
      {entries.length > 0 ? (
        <div className="p4-stagger flex flex-col">
          {entries.map((entry) => (
            <UpcomingRow key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="m-0 border-b border-ink-200 py-3.5 text-caption text-ink-600">這週還沒有排。上面挑一場，排進行程。</p>
      )}
    </section>
  );
}

export function SomeoneSaid({ entries }: { entries: FeedEntry[] }) {
  return (
    <section aria-labelledby="before-said" className="mt-6 flex flex-col">
      <SectionHead
        id="before-said"
        title="有人說了"
        aside={
          <Link href={FEED_PATH} className="text-ink-600 no-underline">
            今晚的目錄 →
          </Link>
        }
      />
      {entries.length > 0 ? (
        <div className="p4-stagger flex flex-col">
          {entries.map((entry, index) => (
            <ListEntry key={entry.id} entry={entry} index={index} />
          ))}
        </div>
      ) : (
        <p className="m-0 border-b border-ink-200 py-3.5 text-caption text-ink-600">今晚還沒有人開口。</p>
      )}
    </section>
  );
}

/** 三塊都空：引導按中央圓鈕（桌機沒有圓鈕，改指刊頭「記一筆」） */
export function AllEmptyGuide() {
  return (
    <div className="mt-6 border-y border-ink-950 py-8 text-center">
      <p className="mx-auto m-0 max-w-[280px] font-serif-tc text-prose leading-[1.7] font-bold text-ink-950">
        <span className="lg:hidden">中央的圓鈕記一筆，</span>
        <span className="hidden lg:inline">右上的「記一筆」，</span>
        選一個之後的時間，就排好了。
      </p>
    </div>
  );
}
