"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatDotDate, issueNumber } from "@/lib/share/article";
import { isShareable, type Visibility } from "@/lib/proof/publish";
import { threadsIntentUrl, threadsPostForArticle } from "@/lib/share/threads-post";
import { formatIssueNo, type Work } from "@/lib/works/format";

export interface PublishedViewProps {
  episodeId: string;
  title: string;
  shareSlug: string;
  visibility: Visibility;
  publishedAt: string;
  authorOrdinal: number;
  workOrdinal: number | null;
  workTitle: string | null;
  generateSocial: boolean;
  /** Threads 模板：引言、一句話（文章副標）、作品（#標籤） */
  pullQuote: string | null;
  lede: string | null;
  work: Pick<Work, "kind" | "title" | "podcast_show"> | null;
}

const VISIBILITY_NOTES: Record<Visibility, string> = {
  public: "",
  unlisted: "只給有連結的人",
  private: "私人",
};

function WorkLine({ workTitle, workOrdinal, visibility }: Pick<PublishedViewProps, "workTitle" | "workOrdinal" | "visibility">) {
  if (!workTitle) return null;
  if (workOrdinal !== null) {
    return (
      <p className="mt-2 mb-0 text-center text-note leading-[1.8] text-ink-700">
        也已收進《{workTitle}》特輯，成為第 {workOrdinal} 段。
      </p>
    );
  }
  return (
    <p className="mt-2 mb-0 text-center text-note leading-[1.8] text-ink-700">
      公開範圍是「{VISIBILITY_NOTES[visibility]}」，不會收進《{workTitle}》特輯。
    </p>
  );
}

/** 期號章碰紙（空白頁出現後 40＋200ms）那一格輕觸一次 */
const STAMP_LAND_MS = 240;

/** 狀態 D：已發佈過場（出刊章、第 n 篇、文章連結、回到目錄） */
export function ProofPublished(props: PublishedViewProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => navigator.vibrate?.(10), STAMP_LAND_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const { title, shareSlug, visibility, publishedAt, authorOrdinal } = props;
  const sharePath = `/s/${shareSlug}`;
  const shareable = isShareable(visibility);

  const shareToThreads = () => {
    const text = threadsPostForArticle({
      visibility,
      pullQuote: props.pullQuote,
      lede: props.lede,
      work: props.work,
      workTitle: props.workTitle,
      shareUrl: `${window.location.origin}${sharePath}`,
    });
    if (text) window.open(threadsIntentUrl(text), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex min-h-dvh flex-col px-4">
      <header className="flex h-[52px] items-center justify-center border-b border-ink-950">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">散場誌</span>
      </header>
      <span className="mt-12 pl-[0.4em] text-center text-caption font-bold tracking-[0.4em] text-ember-dark">
        出刊
      </span>
      <div className="proof-stamp mx-auto mt-6 box-border flex size-44 items-center justify-center rounded-full border-2 border-ember-dark">
        <div className="box-border flex size-[158px] flex-col items-center justify-center gap-1.5 rounded-full border border-ember-dark">
          <span className="pl-[0.3em] text-eyebrow tracking-[0.3em] text-ember-dark">散場誌</span>
          <span className="pl-[0.1em] font-serif-tc text-[30px] font-bold tracking-[0.1em] text-ember-dark">已發佈</span>
          <span className="block h-px w-24 bg-ember-dark" />
          <span className="text-[10px] tracking-[0.06em] whitespace-nowrap text-ember-dark tabular-nums">
            {formatDotDate(publishedAt)}・{formatIssueNo(issueNumber(props.episodeId))}
          </span>
        </div>
      </div>
      <h1 className="mt-10 mb-0 text-center font-serif-tc text-section leading-[1.6] font-bold text-ink-950">
        這是你的第 {authorOrdinal} 篇。
      </h1>
      <WorkLine workTitle={props.workTitle} workOrdinal={props.workOrdinal} visibility={visibility} />

      {shareable ? (
        <Link
          href={sharePath}
          className="proof-after-stamp mt-[22px] flex items-center gap-3 border-y border-ink-200 py-3.5 text-inherit no-underline [animation-delay:320ms]"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="font-serif-tc text-lede leading-[1.5] font-bold text-ink-950">{title}</span>
            <span className="truncate text-eyebrow text-ink-600">{sharePath}</span>
          </span>
          <span className="flex-none text-note text-ember-dark">看文章 →</span>
        </Link>
      ) : (
        <div className="proof-after-stamp mt-[22px] flex flex-col gap-[3px] border-y border-ink-200 py-3.5 [animation-delay:320ms]">
          <span className="font-serif-tc text-lede leading-[1.5] font-bold text-ink-950">{title}</span>
          <span className="text-eyebrow text-ink-600">私人・只存在你的專欄，不開放分享連結</span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1 pt-10 pb-7">
        {shareable ? (
          <button
            type="button"
            onClick={shareToThreads}
            className="proof-after-stamp flex h-[52px] items-center justify-center rounded-[4px] border border-ink-950 text-lede font-bold text-ink-950 [animation-delay:360ms]"
          >
            分享到 Threads
          </button>
        ) : null}
        <Link
          href="/"
          className="proof-after-stamp flex min-h-11 items-center justify-center text-note text-ink-700 no-underline [animation-delay:400ms]"
        >
          回到目錄
        </Link>
      </div>
    </div>
  );
}
