import { workSeoTitle } from "@/lib/seo/article";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { InfoBox } from "@/components/share/info-box";
import { isProgrammeWork, ProgrammePage } from "@/components/venue/programme-page";
import { CastSection } from "@/components/works/feature/cast-section";
import { FeatureResonance } from "@/components/works/feature/feature-resonance";
import { FeatureStats } from "@/components/works/feature/feature-stats";
import { FeelingGroups } from "@/components/works/feature/feeling-groups";
import { WorkCta } from "@/components/works/work-cta";
import { WorkHero } from "@/components/works/work-hero";
import { formatIssueMonth } from "@/lib/share/article";
import {
  formatIssueLatin,
  isListenKind,
  isOnSite,
  isMusic,
  isPodcast,
  KIND_LABELS,
  onSiteInfoRows,
  relativeTimeLabel,
  workDisplayName,
  workMetaLine,
  workVerb,
} from "@/lib/works/format";
import { findWorkBySlug } from "@/lib/works/repository";
import { findListenEpisodeIdForWork, listenHref } from "@/lib/listen/repository";
import { loadFeatureData } from "@/lib/resonance/feature-repository";
import { communityEnabled } from "@/lib/features";
import { loadInfoBoxLinks } from "@/lib/links/info-box";
import { JsonLd } from "@/components/seo/json-ld";
import { siteOriginString } from "@/lib/seo/site";
import { workJsonLd } from "@/lib/seo/work";
import { loadWorkRatingSummary } from "@/lib/watched/rating-repository";
import { ratingSummaryLabel, type RatingSummary } from "@/lib/watched/rating-summary";
import { workPageUrl } from "@/lib/watched/post";
import "./works.css";

export const dynamic = "force-dynamic";

const BRAND = "散場誌";

const loadWorkPage = cache(async (slug: string) => {
  const work = await findWorkBySlug(slug);
  if (!work) return null;
  const [feature, listenEpisodeId, box, rating] = await Promise.all([
    loadFeatureData(work.id, new Date(), communityEnabled()),
    isPodcast(work) ? findListenEpisodeIdForWork(work.id) : Promise.resolve(null),
    loadInfoBoxLinks(work),
    loadWorkRatingSummary(work.id).catch((error: unknown): RatingSummary => {
      // 星等彙總失敗不擋作品頁
      console.error("[works] 讀取星等彙總失敗", error instanceof Error ? error.message : error);
      return { count: 0, average: null };
    }),
  ]);
  return { work, feature, listenEpisodeId, box, rating };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadWorkPage(slug);
  if (!data) return { title: `作品特輯｜${BRAND}` };
  return {
    title: workSeoTitle(data.work.title, data.work.kind),
    description: data.work.synopsis ?? `《${data.work.title}》看完、聽完的人在散場之後說了什麼，附在哪看、去哪買票。`,
    alternates: { canonical: `/works/${slug}` },
  };
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

export default async function WorkFeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadWorkPage(slug);
  if (!data) notFound();
  if (isProgrammeWork(data.work)) return <ProgrammePage workId={data.work.id} />;

  const { work, feature, listenEpisodeId, box, rating } = data;
  const ratingLabel = ratingSummaryLabel(rating);
  const { feelings } = feature;
  const now = new Date();
  const podcast = isPodcast(work);
  const verb = workVerb(work);
  const displayName = workDisplayName(work);
  const count = feelings.length;
  const latest = feelings[0]?.publishedAt ?? null;

  return (
    <div className="flex flex-col pb-[96px]">
      <JsonLd
        data={workJsonLd({
          kind: work.kind,
          title: work.title,
          url: workPageUrl(siteOriginString(), work.slug),
          image: work.poster_url,
          year: work.year,
          rating,
        })}
      />
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950">
        <Link
          href="/works"
          aria-label="返回作品索引"
          className="-ml-3 flex size-11 items-center justify-center text-ink-950"
        >
          <BackIcon />
        </Link>
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">
          {BRAND}
        </span>
        <span className="w-16 text-right text-eyebrow tracking-[0.14em] text-ink-600">
          作品特輯
        </span>
      </header>

      <WorkHero work={work} cardTitle={podcast ? (work.podcast_show ?? work.title) : work.title} />

      <div className="px-4">
        <div className="mt-6 flex items-center gap-2.5 text-caption tracking-[0.2em]">
          <span className={`font-bold ${podcast ? "text-ink-700" : "text-ember-dark"}`}>
            {KIND_LABELS[work.kind]}
          </span>
          <span aria-hidden="true" className="block h-px w-5 flex-none bg-ink-400" />
          <span className="min-w-0 tracking-[0.08em] text-ink-700">{workMetaLine(work)}</span>
        </div>

        {work.synopsis ? (
          <p className="mt-3.5 mb-0 font-serif-tc text-prose leading-[1.85] text-ink-800">
            {work.synopsis}
          </p>
        ) : null}

        {listenEpisodeId ? (
          <Link
            href={listenHref(listenEpisodeId)}
            className="mt-5 flex min-h-12 items-center justify-between border-y border-ink-200 text-note text-ink-950 no-underline"
          >
            <span>聽／讀這一集・逐字稿與重點</span>
            <span className="font-bold text-ember-dark">打開單集 →</span>
          </Link>
        ) : null}

        {ratingLabel ? (
          <p className="mt-4 mb-0 text-caption tracking-[0.06em] text-ink-700 tabular-nums" data-testid="work-rating">
            {ratingLabel}
          </p>
        ) : null}

        <FeatureStats
          count={count}
          weekPeople={feature.cast.length}
          latest={latest ? relativeTimeLabel(latest, now) : null}
        />

        <FeatureResonance
          layout={feature.resonance}
          source={feature.source}
          workName={displayName}
          subjectLabel={podcast ? "這一集" : isMusic(work) ? "這張專輯" : "這部作品"}
          verb={verb}
        />

        {communityEnabled() ? (
          <CastSection cast={feature.cast} weekStart={feature.weekStart} now={now} workName={displayName} verb={verb} />
        ) : null}

        <FeelingGroups feelings={feelings} workTitle={work.title} weekStart={feature.weekStart} now={now} />

        <InfoBox
          infoRows={isOnSite(work) ? onSiteInfoRows(work) : []}
          watch={box.watch}
          links={box.links}
          podcast={isListenKind(work)}
          readHref={listenEpisodeId ? listenHref(listenEpisodeId) : null}
        />
      </div>

      <WorkCta
        slug={work.slug}
        feelingCount={count}
        headlineTarget={podcast ? "這一集" : `《${work.title}》`}
        prefillName={displayName}
        verb={verb}
      />

      <footer className="flex flex-col items-center gap-2 px-4 pt-7 pb-10">
        <div className="flex w-full items-center gap-2.5">
          <span className="block h-px flex-1 bg-ink-200" />
          <span className="text-eyebrow tracking-[0.3em] text-ink-600 tabular-nums">
            特輯 No.{formatIssueLatin(work.issue_no)}
          </span>
          <span className="block h-px flex-1 bg-ink-200" />
        </div>
        <span className="text-center font-serif-tc text-note text-ink-950">
          {displayName} · {count > 0 ? `收錄 ${count} 段感受` : "等待第一段"}
        </span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">
          {BRAND} · {formatIssueMonth(now.toISOString())}
          {count > 0 ? " · 持續收錄中" : ""}
        </span>
      </footer>
    </div>
  );
}
