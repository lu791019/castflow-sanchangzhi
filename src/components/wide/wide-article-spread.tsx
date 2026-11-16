import Link from "next/link";
import { WorkCover } from "@/components/covers/work-cover";
import { PenSeal } from "@/components/seal/pen-seal";
import { headlineScale, type HeadlineScale } from "@/lib/wide/layout";
import { posterSourceLabel, type Work } from "@/lib/works/format";

/**
 * 寬版文章頁跨頁（Q-60 雛型 Article）：左頁滿版海報、右頁大標＋導言＋署名。只在 ≥1024 出現；
 * 窄版的標題、署名、作品卡在 lg 藏起來。放在 main 的格線裡（跨兩欄）、用負邊距撐滿視窗寬。
 */

const TITLE_SIZE: Record<HeadlineScale, string> = {
  short: "text-[clamp(64px,9vw,136px)] leading-[1.02] tracking-[0.04em]",
  medium: "text-[clamp(48px,5vw,80px)] leading-[1.12] tracking-[0.02em]",
  long: "text-[clamp(36px,3.4vw,56px)] leading-[1.3]",
};

interface WideArticleSpreadProps {
  title: string;
  lede: string | null;
  /** 觀影隨筆／隨筆 */
  category: string;
  author: string;
  /** 筆名署名才蓋印章；匿名不露 */
  sealed: boolean;
  recordedLine: string;
  date: string;
  work: Work | null;
}

function SpreadFigure({ work }: { work: Work }) {
  return (
    <figure className="relative m-0 min-h-[560px] flex-[1_1_480px] bg-paper-2">
      {/* 海報不撐高：跨頁高度由右頁文字決定（至少 560），海報裁切填滿 */}
      <div className="absolute inset-0 flex">
        <WorkCover
          cover={{ kind: work.kind, title: work.title, posterUrl: work.poster_url }}
          size="xl"
          eager
          alt={work.poster_url ? `《${work.title}》海報` : ""}
          className="w-full"
        />
      </div>
      {work.poster_url ? (
        <figcaption className="p4-inverse absolute bottom-5 left-6 bg-ink-950/70 px-2.5 py-1.5 text-caption tracking-[0.16em] text-paper">
          《{work.title}》{posterSourceLabel(work)}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function WideArticleSpread({ title, lede, category, author, sealed, recordedLine, date, work }: WideArticleSpreadProps) {
  return (
    <section className="hidden border-b border-ink-950 lg:col-span-full lg:row-start-1 lg:mx-[calc(50%-50vw)] lg:flex">
      {work ? <SpreadFigure work={work} /> : null}
      <div
        className={`flex min-w-0 flex-[1_1_520px] flex-col justify-end px-[clamp(24px,5vw,88px)] pt-16 pb-14 ${work ? "border-l border-ink-950" : ""}`}
      >
        <span className="text-note font-bold tracking-[0.3em] text-ember-dark">散場之後　——　{category}</span>
        <h1 className={`mt-5 mb-0 font-serif-tc font-black text-ink-950 ${TITLE_SIZE[headlineScale(title)]}`}>{title}</h1>
        {lede ? <p className="mt-7 mb-0 max-w-[34em] font-serif-tc text-[clamp(20px,1.8vw,26px)] leading-[1.7] text-ink-700">{lede}</p> : null}
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-ink-950 pt-3.5 text-note">
          {sealed ? <PenSeal penName={author} size={40} /> : null}
          <span className="font-bold text-ink-950">
            文／{author}
            <span className="font-normal text-ink-600"> 口述 · AI 整理</span>
          </span>
          <span className="text-ink-600">{recordedLine}</span>
          <span className="tracking-[0.06em] text-ink-600 tabular-nums">{date}</span>
        </div>
      </div>
    </section>
  );
}

/** 資訊欄底部「看作品特輯 →」（寬版；窄版在作品卡上） */
export function WideWorkLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/works/${slug}`}
      className="mt-[18px] hidden min-h-11 items-center text-note font-bold tracking-[0.12em] text-ember-dark no-underline hover:text-ember-deep lg:inline-flex"
    >
      看作品特輯 →
    </Link>
  );
}
