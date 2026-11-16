/**
 * 場刊頁（設計稿「P3 場外 A 音樂祭場刊／B 展覽場刊」）：場外作品（演出 live／展覽 exhibition）的作品頁。
 * works/[slug]/page.tsx 遇到場外作品就 render 這裡；一般作品特輯版面不受影響。
 */

import Link from "next/link";
import { CoverRequest } from "@/components/covers/cover-request";
import { ProgrammeLinks } from "@/components/links/programme-links";
import { buildProgramme, type ProgrammeView } from "@/lib/venue/programme";
import { listProgrammeFeelings, loadProgrammeWork } from "@/lib/venue/programme-repository";
import type { Work } from "@/lib/works/format";
import { communityEnabled } from "@/lib/features";
import { ProgrammeCover, ProgrammeNotch } from "./programme-cover";
import { ProgrammeFeelings, ProgrammeInfo, ProgrammePeople } from "./programme-sections";

const BRAND = "散場誌";

/** 場外作品才有場刊 */
export function isProgrammeWork(work: Pick<Work, "kind">): boolean {
  return work.kind === "live" || work.kind === "exhibition";
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width={direction === "left" ? 20 : 18} height={direction === "left" ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={direction === "left" ? 1.6 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stroke-paper" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/** 深色 CTA：撕線缺口＋「你也在那一場？」→ /say?work=<slug>（深色區塊不放印章） */
function ProgrammeCta({ cta, slug }: { cta: ProgrammeView["cta"]; slug: string }) {
  return (
    <section className="p4-inverse p4-band flex flex-col bg-ink-950 px-4 pb-10 text-paper">
      <ProgrammeNotch dark />
      <span className="mt-3 text-caption tracking-[0.2em] text-ember-soft">{cta.kicker}</span>
      <h2 className="mt-3 mb-0 font-serif-tc text-headline leading-[1.4] font-bold">
        <span className="block">{cta.lines[0]}</span>
        <span className="block">{cta.lines[1]}</span>
      </h2>
      <p className="mt-3 mb-0 text-note leading-[1.85] text-ink-300">{cta.body}</p>
      <Link
        href={`/say?work=${encodeURIComponent(slug)}`}
        className="mt-[26px] flex h-[60px] items-center gap-3.5 rounded-[30px] bg-paper pr-5 pl-2 text-ink-950 no-underline"
      >
        <span className="relative block size-11 flex-none">
          <span className="absolute -inset-[5px] block rounded-full border border-ember-soft" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ember-dark">
            <MicIcon />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-lede font-bold">說一段</span>
          <span className="truncate text-eyebrow text-ink-700">{cta.sub}</span>
        </span>
        <Chevron direction="right" />
      </Link>
    </section>
  );
}

export async function ProgrammePage({ workId }: { workId: string }) {
  const [work, feelings] = await Promise.all([loadProgrammeWork(workId), listProgrammeFeelings(workId)]);
  if (!work) return null;
  const view = buildProgramme(work, feelings, new Date());

  return (
    <div className="flex min-h-full flex-col pb-[96px] [--programme-page:var(--color-paper)]">
      <header className="mx-4 flex h-[52px] flex-none items-center justify-between border-b border-ink-950">
        <Link href="/works" aria-label="返回作品索引" className="-ml-3 flex size-11 items-center justify-center text-ink-950">
          <Chevron direction="left" />
        </Link>
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">{BRAND}</span>
        <span className="w-16 text-right text-eyebrow tracking-[0.14em] text-ink-600">場外</span>
      </header>

      <ProgrammeCover workId={work.id} view={view} coverRequest={<CoverRequest workId={work.id} posterUrl={view.posterUrl} stamped={view.stamp !== null} />} />

      <div className="px-4">
        {communityEnabled() ? <ProgrammePeople view={view} /> : null}
        <ProgrammeFeelings view={view} />
        <ProgrammeInfo view={view} />
        <ProgrammeLinks workId={work.id} workKind={work.kind} />
      </div>

      <div className="min-h-12 flex-1" />
      <ProgrammeCta cta={view.cta} slug={work.slug} />

      <footer className="flex flex-col items-center gap-2 px-4 pt-7 pb-10">
        <div className="flex w-full items-center gap-2.5">
          <span className="block h-px flex-1 bg-ink-200" />
          <span className="text-eyebrow tracking-[0.3em] text-ink-600 tabular-nums">{view.footNo}</span>
          <span className="block h-px flex-1 bg-ink-200" />
        </div>
        <span className="text-center font-serif-tc text-note text-ink-950">{view.footLine}</span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">
          {BRAND}・場外・{view.footMonth}
        </span>
      </footer>
    </div>
  );
}
