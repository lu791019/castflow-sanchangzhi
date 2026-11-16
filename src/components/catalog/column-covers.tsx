/**
 * 索引 › 欄目：固定欄目封面（column.cover：主欄 343×208 全寬；其餘兩欄並排，高 220、欄距 12、列距 26）。
 * 「現場」是整本索引唯一的深色封面（column.cover.night），深色區塊不放印章。
 */

import Link from "next/link";
import { CATALOG_COLUMNS, type ColumnKey } from "@/lib/catalog/columns";
import type { ColumnCoverData } from "@/lib/catalog/types";

const columnHref = (key: ColumnKey) => `/catalog?tab=columns&column=${key}`;
const info = (key: ColumnKey) => CATALOG_COLUMNS.find((column) => column.key === key)!;

function Caption({ columnKey, count }: { columnKey: ColumnKey; count: number }) {
  const column = info(columnKey);
  return (
    <>
      <span className="flex items-baseline gap-2">
        <span className="font-serif-tc text-lede font-bold text-ink-950">{column.name}</span>
        <span className="text-eyebrow text-ink-600">{count} 篇</span>
      </span>
      <span className="-mt-1 text-caption leading-[1.6] text-ink-700">{column.description}</span>
    </>
  );
}

function VerticalTitle({ tagline, name, size }: { tagline: string; name: string; size: "lg" | "md" }) {
  return (
    <span className="flex items-start gap-1.5">
      <span className="text-eyebrow font-bold tracking-[0.3em] text-ember-dark [writing-mode:vertical-rl]">{tagline}</span>
      <span
        className={`font-serif-tc font-bold text-ink-950 [writing-mode:vertical-rl] ${
          size === "lg" ? "text-headline leading-[1.1] tracking-[0.2em]" : "text-section tracking-[0.16em]"
        }`}
      >
        {name}
      </span>
    </span>
  );
}

function EssayCover({ data }: { data: ColumnCoverData }) {
  const column = info("essay");
  return (
    <Link href={columnHref("essay")} className="flex flex-col gap-2.5 text-inherit no-underline">
      <span className="box-border grid h-[208px] grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t-2 border-b border-ink-950 bg-paper-2 pt-3.5 pr-3.5 pb-3 pl-4">
        <span className="flex flex-col justify-between border-r border-ink-300 pr-4">
          <span className="text-eyebrow tracking-[0.24em] text-ink-600">{data.issueLabel}・本期</span>
          {data.essayQuote ? (
            <span className="flex flex-col">
              <span aria-hidden="true" className="h-5 font-serif-tc text-headline leading-[0.8] text-ember">「</span>
              <span className="line-clamp-3 font-serif-tc text-prose leading-[1.6] font-semibold text-ink-950">{data.essayQuote.quote}</span>
            </span>
          ) : (
            <span />
          )}
          {data.essayQuote ? (
            <span className="truncate text-eyebrow tracking-[0.08em] text-ink-700">
              ——{data.essayQuote.penName}
              {data.essayQuote.workTitle ? `〈${data.essayQuote.workTitle}〉` : ""}
            </span>
          ) : (
            <span />
          )}
        </span>
        <VerticalTitle tagline={column.tagline} name="散場之後" size="lg" />
      </span>
      <span className="flex items-baseline gap-2.5">
        <span className="font-serif-tc text-prose font-bold text-ink-950">{column.name}</span>
        <span className="text-caption text-ink-600">{data.counts.essay} 篇</span>
      </span>
      <span className="-mt-1 text-note leading-[1.7] text-ink-700">{column.description}</span>
    </Link>
  );
}

const STOPS = ["第一集", "第二集", "第三集", "下車"];

function CommuteCover() {
  return (
    <span className="box-border flex h-[220px] justify-between border border-t-2 border-ink-950 bg-paper px-3 py-3.5">
      <span aria-hidden="true" className="relative flex w-16 flex-col justify-between py-1">
        <span className="absolute top-2.5 bottom-2.5 left-1 block w-px bg-ink-950" />
        {STOPS.map((stop, index) => (
          <span key={stop} className={`relative flex items-center gap-2 text-eyebrow ${index === 2 ? "font-bold text-ember-deep" : "text-ink-600"}`}>
            <span className={`block size-[9px] rounded-full ${index === 2 ? "bg-ember" : "box-border border border-ink-950 bg-paper"}`} />
            {stop}
          </span>
        ))}
      </span>
      <VerticalTitle tagline={info("commute").tagline} name="影集通勤" size="md" />
    </span>
  );
}

function OneLineCover({ line }: { line: string | null }) {
  return (
    <span className="relative box-border block h-[220px] border-t-2 border-r border-b border-t-ink-950 border-r-ink-200 border-b-ink-950 bg-paper bg-[linear-gradient(var(--color-ink-200)_1px,transparent_1px),linear-gradient(90deg,var(--color-ink-200)_1px,transparent_1px)] bg-[length:30px_30px] bg-[position:right_top]">
      <span className="absolute top-0 right-0 box-border flex h-[132px] w-[46px] justify-center border-b border-l border-ink-950 bg-paper pt-2.5">
        <span className="font-serif-tc text-section font-bold tracking-[0.12em] text-ink-950 [writing-mode:vertical-rl]">一集一句</span>
      </span>
      {line ? (
        <span className="absolute top-0 right-[60px] w-[30px] pt-[7px] font-serif-tc text-lede leading-[30px] tracking-[15px] text-ember-deep [writing-mode:vertical-rl]">
          {line}
        </span>
      ) : null}
    </span>
  );
}

function OnsiteCover({ onsite }: { onsite: ColumnCoverData["onsite"] }) {
  return (
    <span className="relative box-border flex h-[220px] flex-col justify-between rounded-[2px] bg-ink-950 px-3 pt-3.5 pb-3">
      <span className="flex justify-end gap-1.5">
        <span className="text-eyebrow font-bold tracking-[0.3em] text-ember-soft [writing-mode:vertical-rl]">{info("onsite").tagline}</span>
        <span className="font-serif-tc text-headline font-bold tracking-[0.2em] text-paper [writing-mode:vertical-rl]">現場</span>
      </span>
      <span aria-hidden="true" className="relative -mx-3 block h-3.5">
        <span className="absolute top-0 -left-[7px] block size-3.5 rounded-full bg-paper" />
        <span className="absolute top-0 -right-[7px] block size-3.5 rounded-full bg-paper" />
        <span className="absolute top-[7px] right-3.5 left-3.5 block border-t border-dashed border-ink-600" />
      </span>
      <span className="flex min-h-9 flex-col gap-0.5">
        {onsite ? (
          <>
            <span className="truncate font-serif-tc text-note font-bold text-paper">{onsite.title}</span>
            <span className="text-eyebrow text-ink-300 tabular-nums">本期・{onsite.date}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}

function RewatchCover() {
  return (
    <span className="relative box-border block h-[220px] border-t-2 border-b border-ink-950 bg-paper-2">
      <span aria-hidden="true" className="absolute top-6 right-[30px] bottom-[34px] left-[18px] block border border-ink-300" />
      <span aria-hidden="true" className="absolute top-[34px] right-5 bottom-6 left-7 block border border-ember" />
      <span className="absolute top-[46px] right-[34px] flex gap-1.5">
        <span className="text-eyebrow tracking-[0.24em] text-ink-700 [writing-mode:vertical-rl]">{info("rewatch").tagline}</span>
        <span className="font-serif-tc text-headline font-bold tracking-[0.2em] text-ink-950 [writing-mode:vertical-rl]">重看</span>
      </span>
    </span>
  );
}

export function ColumnCovers({ data }: { data: ColumnCoverData }) {
  const small: Array<{ key: ColumnKey; cover: React.ReactNode }> = [
    { key: "commute", cover: <CommuteCover /> },
    { key: "one_line", cover: <OneLineCover line={data.oneLine} /> },
    { key: "onsite", cover: <OnsiteCover onsite={data.onsite} /> },
    { key: "rewatch", cover: <RewatchCover /> },
  ];
  return (
    <div className="flex flex-col gap-7 px-4 pt-5">
      <EssayCover data={data} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-[26px]">
        {small.map(({ key, cover }) => (
          <Link key={key} href={columnHref(key)} className="flex min-w-0 flex-col gap-2 text-inherit no-underline">
            {cover}
            <Caption columnKey={key} count={data.counts[key]} />
          </Link>
        ))}
      </div>
    </div>
  );
}
