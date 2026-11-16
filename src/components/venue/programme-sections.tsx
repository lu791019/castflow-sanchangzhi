import Link from "next/link";
import { Seal } from "@/components/seal/seal";
import { authorPath } from "@/lib/authors/path";
import type { ProgrammeGroupView, ProgrammeView } from "@/lib/venue/programme";

/** group.subhead：明體 15 粗「第 2 晚」＋段數 13 ＋髮絲線＋日期 11 */
function GroupHead({ label, count, date, className }: { label: string; count: string; date: string; className: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="font-serif-tc text-lede font-bold tracking-[0.12em] text-ink-950">{label}</span>
      <span className="font-serif-tc text-note text-ink-600">{count}</span>
      <span className="block h-px flex-1 bg-ink-200" />
      <span className="text-eyebrow tracking-[0.06em] text-ink-600 tabular-nums">{date}</span>
    </div>
  );
}

function PeopleRow({ group }: { group: ProgrammeGroupView }) {
  return (
    <div className="border-b border-ink-200 pt-3 pb-3.5">
      <div className="grid grid-cols-5 gap-y-3">
        {group.people.map((person) => (
          <Link
            key={person.penName}
            href={authorPath(person.penName)}
            aria-label={`${person.penName}的專欄`}
            className="flex min-h-11 flex-col items-center gap-1.5 no-underline"
          >
            <Seal penName={person.penName} glyph={person.glyph} size={40} />
            <span className="max-w-full truncate text-caption font-bold text-ink-950">{person.penName}</span>
          </Link>
        ))}
      </div>
      {group.morePeople > 0 ? (
        <p className="mt-2.5 mb-0 text-caption text-ink-600">和另外 {group.morePeople} 人</p>
      ) : null}
    </div>
  );
}

/** 同場：這場散場的人（同一晚一列；展覽以展期一列）。只放以筆名署名、公開發佈的人 */
export function ProgrammePeople({ view }: { view: ProgrammeView }) {
  const groups = view.groups.filter((group) => group.people.length > 0);
  return (
    <section className="mt-12">
      <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">同場</span>
      <h2 className="mt-2 mb-0 font-serif-tc text-section font-bold text-ink-950">{view.peopleTitle}</h2>
      <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">{view.peopleDek}</p>
      {groups.length > 0 ? (
        <div className="mt-3.5 border-t border-ink-950">
          {groups.map((group) => (
            <div key={group.key}>
              <GroupHead label={group.label} count={group.countLabel} date={group.dateLabel} className="pt-4" />
              <PeopleRow group={group} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** 感受列表：依散場時間分晚；匿名署名不露印章 */
export function ProgrammeFeelings({ view }: { view: ProgrammeView }) {
  return (
    <section className="mt-[52px]">
      <div className="flex items-baseline justify-between border-b border-ink-950 pb-2.5">
        <h2 className="m-0 font-serif-tc text-section font-bold text-ink-950">{view.countTitle}</h2>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">依散場時間</span>
      </div>
      {view.groups.map((group) => (
        <div key={group.key}>
          <GroupHead label={group.label} count={group.feelingCountLabel} date={group.dateLabel} className="pt-[22px] pb-0.5" />
          {group.rows.map((row) => (
            <Link
              key={row.episodeId}
              href={`/s/${row.shareSlug}`}
              className="flex flex-col gap-2 border-b border-ink-200 pt-[18px] pb-5 text-inherit no-underline"
            >
              <span className="flex items-center gap-2.5">
                {row.penName ? <Seal penName={row.penName} glyph={row.glyph} size={24} /> : null}
                <span className="min-w-0 truncate text-note font-bold text-ink-950">{row.author}</span>
                <span className="flex-1" />
                <span className="flex-none text-eyebrow text-ink-600 tabular-nums">{row.sig}</span>
              </span>
              <span className="font-serif-tc text-prose leading-[1.55] font-bold text-ink-950">{row.title}</span>
              {row.pullQuote ? <span className="text-note leading-[1.75] text-ink-700">{row.pullQuote}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </section>
  );
}

/** 資訊欄：場外沒有外部資料源，只列手寫的場地與日期 */
export function ProgrammeInfo({ view }: { view: ProgrammeView }) {
  if (view.info.length === 0) return null;
  return (
    <section className="mt-[52px] border-t-2 border-ink-950">
      <div className="flex justify-between pt-2.5">
        <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">資訊欄</span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">INFO</span>
      </div>
      <h2 className="mt-2.5 mb-0 text-lede font-bold tracking-[0.06em] text-ink-950">{view.infoTitle}</h2>
      <div className="mt-1 flex flex-col">
        {view.info.map((row) => {
          const cells = (
            <>
              <span className="text-caption tracking-[0.08em] text-ink-600">{row.label}</span>
              <span className="font-serif-tc text-lede leading-normal font-bold">{row.value}</span>
              <span className="text-note font-bold text-ember-dark">{row.href ? "地圖 ↗" : ""}</span>
            </>
          );
          const className = "grid min-h-[52px] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-ink-200 text-ink-950 no-underline";
          return row.href ? (
            <a key={row.label} href={row.href} target="_blank" rel="noopener noreferrer" className={className}>
              {cells}
            </a>
          ) : (
            <div key={row.label} className={className}>
              {cells}
            </div>
          );
        })}
      </div>
      <p className="mt-2 mb-0 text-eyebrow text-ink-600">場外資訊由第一位記下的人手寫，僅供參考。</p>
    </section>
  );
}
