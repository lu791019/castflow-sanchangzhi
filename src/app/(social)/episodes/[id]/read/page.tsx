import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ReadingStage } from "@/components/listen/reading-stage";
import { LampToggle } from "@/components/theme/lamp-toggle";
import {
  hasTranslation,
  parseReadingMode,
  withChapterLengths,
} from "@/lib/listen/display";
import { coverCardNumber, episodeMetaLine, episodeNumberLabel } from "@/lib/listen/episode-meta";
import { buildSayHref } from "@/lib/listen/playback";
import { estimateRemainingMinutes, processingStages } from "@/lib/listen/progress";
import { loadListenPage, type ListenEpisode } from "@/lib/listen/repository";
import "./listen.css";

export const dynamic = "force-dynamic";

const BRAND = "散場誌";

const loadPage = cache(async (id: string) => loadListenPage(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPage(id);
  if (!data) return { title: `單集｜${BRAND}` };
  const show = data.episode.show.title;
  return { title: `${data.episode.title}${show ? `｜${show}` : ""}｜${BRAND}` };
}

function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

/** 封面一律用節目封面（單集封面常缺）；沒有封面時用直排字卡 */
function ShowCover({ episode }: { episode: ListenEpisode }) {
  const showTitle = episode.show.title ?? "Podcast";
  if (episode.show.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 節目封面來自外部 RSS，不經 next/image 最佳化
      <img
        src={episode.show.imageUrl}
        alt={`《${showTitle}》節目封面`}
        className="box-border block size-24 border-t-2 border-b border-ink-950 bg-paper-2 object-cover"
      />
    );
  }
  const number = coverCardNumber(episode);
  return (
    <div
      aria-label={`《${showTitle}》字卡`}
      className="box-border flex size-24 justify-between overflow-hidden border-t-2 border-b border-ink-950 bg-paper-2 px-2 pt-2 pb-1.5"
    >
      <span className="self-end font-serif-tc text-headline leading-[0.9] font-bold text-ember-dark tabular-nums">
        {number ?? ""}
      </span>
      <span className="max-h-[80px] overflow-hidden font-serif-tc text-lede leading-[1.15] font-bold text-ink-950 [writing-mode:vertical-rl]">
        {showTitle}
      </span>
    </div>
  );
}

function prefillName(episode: ListenEpisode): string | null {
  if (!episode.work) return null;
  const show = episode.work.podcastShow ?? episode.show.title;
  if (!show) return `《${episode.work.title}》`;
  const number = episodeNumberLabel(episode);
  return `《${show}》${number ?? "這一集"}`;
}

function disclaimerText(bilingual: boolean, episode: ListenEpisode): string {
  const ai = bilingual ? "逐字稿由 AI 轉錄與翻譯，可能有誤。" : "逐字稿由 AI 轉錄，可能有誤。";
  const host = episode.show.feedUrl ? safeHost(episode.show.feedUrl) : null;
  const source = [episode.show.title, "RSS", host ? `（${host}）` : null].filter(Boolean).join(" ");
  return `${ai}\n節目資料來源：${source}`;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export default async function EpisodeReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  const data = await loadPage(id);
  if (!data) notFound();

  const { episode, reading } = data;
  const showTitle = episode.show.title ?? episode.work?.podcastShow ?? null;
  const bilingual = hasTranslation(data.segments);
  const stages = processingStages({
    hasTranscript: data.hasTranscript,
    episodeStatus: episode.status,
    readingStatus: reading.status,
  });
  const workHref = episode.work ? `/works/${episode.work.slug}` : null;
  const metaLine = episodeMetaLine(episode);

  return (
    <div className="flex flex-col">
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950">
        <Link
          href={workHref ?? "/?tab=podcast"}
          aria-label="返回"
          className="-ml-3 flex size-11 items-center justify-center text-ink-950"
        >
          <BackIcon />
        </Link>
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">{BRAND}</span>
        <LampToggle />
      </header>

      <section className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-x-4 px-4 pt-6">
        <ShowCover episode={episode} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-eyebrow font-bold tracking-[0.2em] text-ink-700">
            PODCAST{showTitle ? `・${showTitle.toUpperCase()}` : ""}
          </span>
          <h1 className="m-0 font-serif-tc text-quote leading-[1.4] font-bold break-words text-ink-950">
            {episode.title}
          </h1>
        </div>
      </section>
      {metaLine ? (
        <p className="mx-4 mt-3.5 mb-0 border-y border-ink-200 py-2.5 text-caption text-ink-700 tabular-nums">
          {metaLine}
        </p>
      ) : null}

      <ReadingStage
        initialMode={parseReadingMode(mode)}
        audioUrl={episode.audioUrl}
        durationSeconds={episode.durationSeconds}
        readable={data.readable}
        segments={data.segments}
        bilingual={bilingual}
        summary={reading.summary}
        summaryNeedsRecompute={reading.summaryNeedsRecompute}
        chapters={withChapterLengths(reading.chapters, data.segments.at(-1)?.end ?? episode.durationSeconds)}
        processing={{
          stages,
          remainingMinutes: estimateRemainingMinutes(episode.durationSeconds, stages),
          failed: reading.status === "error",
        }}
        workSlug={episode.work?.slug ?? null}
        cta={{
          sayHref: buildSayHref(episode.work?.slug ?? null),
          prefillName: prefillName(episode),
          workHref,
          feelingCount: data.feelingCount,
        }}
        disclaimer={disclaimerText(bilingual, episode)}
      />
    </div>
  );
}
