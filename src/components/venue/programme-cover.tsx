import type { ReactNode } from "react";
import { CoverSlot } from "@/components/covers/cover-override";
import { WorkCover } from "@/components/covers/work-cover";
import { safeImageUrl } from "@/lib/covers/cover";
import type { ProgrammeView } from "@/lib/venue/programme";

/** 撕線：兩端半圓缺口（紙色）＋虛線；深色帶上同樣切出紙色缺口（programme.notch） */
export function ProgrammeNotch({ dark = false }: { dark?: boolean }) {
  return (
    <div aria-hidden="true" className={`relative ${dark ? "-mx-4 h-10" : "mt-[22px] h-[22px]"}`}>
      {["-left-[11px]", "-right-[11px]"].map((side) => (
        <span
          key={side}
          className={`absolute ${side} ${dark ? "top-[9px]" : "top-0"} block size-[22px] rounded-full bg-[var(--programme-page)]`}
        />
      ))}
      <span
        className={`absolute right-5 left-5 block border-t border-dashed ${dark ? "top-[19px] border-ink-600" : "top-2.5 border-ink-400"}`}
      />
    </div>
  );
}

/** stamp.ended：「已散場」戳，旋轉 −6°，壓在字卡下緣與撕線上 */
function EndedStamp({ stamp }: { stamp: NonNullable<ProgrammeView["stamp"]> }) {
  const line = stamp.time ? `${stamp.date}・${stamp.time}` : stamp.date;
  return (
    <div
      aria-label={`已散場，${line}`}
      role="img"
      className="absolute -bottom-7 left-0.5 w-[92px] -rotate-6 rounded-control border-[1.5px] border-ember-dark bg-paper-2 p-[3px]"
    >
      <div className="flex flex-col items-center gap-px rounded-[2px] border border-ember-dark pt-[5px] pb-1">
        <span className="pl-[0.16em] font-serif-tc text-lede font-bold tracking-[0.16em] text-ember-dark">已散場</span>
        <span className="text-eyebrow tracking-[0.06em] text-ember-dark tabular-nums">{line}</span>
      </div>
    </div>
  );
}

/** 場刊封面帶（programme.band）：演出名明體 30、場地／日期 dl、封面（讀者給的圖；沒有走直排字卡＋「補封面」）、已散場戳、撕線、統計 */
/** 有圖時的封面尺寸（server 畫的圖與「補封面」通過後直接換上的圖同一個版型） */
const POSTER_SIZE = "h-[150px] w-[100px]";

export function ProgrammeCover({ workId, view, coverRequest = null }: { workId: string; view: ProgrammeView; coverRequest?: ReactNode }) {
  return (
    <section className="mt-5 border-t-2 border-ink-950 bg-paper-2">
      <div className="px-4 pt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">{view.eyebrow}</span>
          <span className="text-eyebrow tracking-[0.14em] text-ink-600">{view.issue}</span>
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_100px] items-start gap-x-4">
          <div className="flex min-w-0 flex-col">
            <h1 className="m-0 font-serif-tc text-headline leading-[1.38] font-bold break-words text-ink-950">
              {view.titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            {view.facts.length > 0 ? (
              <dl className="mt-4 mb-0 border-t border-ink-950">
                {view.facts.map((fact) => (
                  <div key={fact.label} className="grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-x-2 border-b border-ink-200 py-[9px]">
                    <dt className="text-eyebrow tracking-[0.14em] text-ink-600">{fact.label}</dt>
                    <dd className="m-0 text-note leading-[1.55] text-ink-950 tabular-nums">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <div className="relative">
            <CoverSlot workId={workId} alt={`${view.titleLines.join("")}封面`} imageClassName={POSTER_SIZE}>
              <WorkCover
                cover={{ kind: view.kind, title: view.plate, posterUrl: view.posterUrl }}
                size="md"
                mark={view.plateMark}
                alt={`${view.titleLines.join("")}封面`}
                eager
                surface="paper"
                className={safeImageUrl(view.posterUrl) ? POSTER_SIZE : "h-[204px] w-[100px]"}
              />
            </CoverSlot>
            {view.stamp ? <EndedStamp stamp={view.stamp} /> : null}
          </div>
        </div>
        {coverRequest}
      </div>

      <ProgrammeNotch />

      <dl className="m-0 grid grid-cols-3 px-4 pt-2.5 pb-4">
        {view.stats.map((stat, index) => (
          <div key={stat.label} className={`flex flex-col gap-0.5 ${index === 0 ? "" : "border-l border-ink-300 pl-3"}`}>
            <dt className="text-eyebrow tracking-[0.14em] text-ink-600">{stat.label}</dt>
            <dd
              className={`m-0 text-ink-950 tabular-nums ${stat.big ? "font-serif-tc text-prose font-bold" : "pt-[3px] text-note"}`}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="h-px bg-ink-950" />
    </section>
  );
}
