import { JsonLd } from "@/components/seo/json-ld";
import { authorPath } from "@/lib/authors/path";
import { articleJsonLd, articleSeoTitle } from "@/lib/seo/article";
import { siteOriginString } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveLede,
  extractPullQuote,
  extractWorkTitle,
  formatDotDate,
  formatIssueMonth,
  issueNumber,
  parseArticle,
  pullQuotePosition,
  type ArticleBlock,
} from "@/lib/share/article";
import { wavePath } from "@/lib/share/wave";
import { ArticleBody } from "@/components/share/article-body";
import { InfoBox } from "@/components/share/info-box";
import { WorkCard } from "@/components/share/work-card";
import {
  isOnSite,
  isListenKind,
  onSiteInfoRows,
  posterCardLabel,
  posterSourceLabel,
  workDisplayName,
  workMetaLine,
  workVerb,
  type Work,
} from "@/lib/works/format";
import { findWorkById } from "@/lib/works/repository";
import { loadInfoBoxLinks, type InfoBoxLinks } from "@/lib/links/info-box";
import { NO_WATCH_INFO, type WatchInfo } from "@/lib/watch/service";
import { loadPenName } from "@/lib/me/pen-name";
import { TourMount } from "@/components/tour/tour-mount";
import { PenSeal } from "@/components/seal/pen-seal";
import {
  displayAuthor,
  isShareable,
  parseByline,
  parseVisibility,
} from "@/lib/proof/publish";
import { journalBylineLabel } from "@/lib/journal/episode-byline";
import { loadEpisodeJournal } from "@/lib/journal/episode-link";
import { shareMetadata, withdrawnMetadata } from "@/lib/share/share-metadata";
import { loadArticleSocial, NO_ARTICLE_SOCIAL } from "@/lib/resonance/article-social";
import { communityEnabled } from "@/lib/features";
import { ResonanceProvider } from "@/components/resonance/resonance-provider";
import { ResonanceHint } from "@/components/resonance/resonance-hint";
import { SameShowSection } from "@/components/resonance/same-show-section";
import { ReaderLetters } from "@/components/letters/reader-letters";
import { ArticleProvenance } from "@/components/import/article-provenance";
import { WideArticleSpread, WideWorkLink } from "@/components/wide/wide-article-spread";
import { Withdrawn } from "./withdrawn";
import { findWithdrawnIssue } from "./withdrawn-issue";
import "./share.css";

export const dynamic = "force-dynamic";

const BRAND = "散場誌";
const SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

interface ShareData {
  /** SEO：發佈時間與作者專欄路徑（匿名為 null） */
  publishedAt: string | null;
  authorPath: string | null;
  episodeId: string;
  /** 文章作者（同場排除本人） */
  authorId: string;
  title: string;
  lede: string | null;
  blocks: ArticleBlock[];
  pullQuote: string | null;
  quoteAfter: number;
  workTitle: string | null;
  work: Work | null;
  source: string;
  issueNo: string;
  issueMonth: string;
  date: string;
  author: string;
  /** 連結視聽日誌時的時間差署名（「10.07 晚上看完 · 隔天說的」）；沒有為 null */
  journalLine: string | null;
  /** 在哪看／在哪聽；null = 該作品類型不顯示（演出／展覽）。沒綁作品時為無資料態 */
  watch: WatchInfo | null;
  links: InfoBoxLinks | null;
}

const getShareData = cache(async (slug: string): Promise<ShareData | null> => {
  if (!SLUG_PATTERN.test(slug)) return null;

  const supabase = createAdminClient();
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("id, title, source, created_at, published_at, work_id, visibility, byline, pull_quote, user_id")
    .eq("share_slug", slug)
    .maybeSingle();
  if (episodeError || !episode) return null;
  // 私人文章只存在作者專欄，不開放分享頁
  if (!isShareable(parseVisibility(episode.visibility) ?? "public")) return null;

  const { data: content, error: contentError } = await supabase
    .from("contents")
    .select("body")
    .eq("episode_id", episode.id)
    .eq("platform", "blog")
    .limit(1)
    .maybeSingle();
  if (contentError || !content?.body) return null;

  const parsed = parseArticle(content.body);
  const { lede, blocks } = deriveLede(parsed.blocks);
  const title = parsed.title ?? episode.title;
  const [work, penName, journal] = await Promise.all([
    episode.work_id ? findWorkById(episode.work_id) : Promise.resolve(null),
    // 署名是文章作者的筆名，不是正在看的人
    loadPenName(episode.user_id as string),
    loadEpisodeJournal(episode.id),
  ]);
  const box = work ? await loadInfoBoxLinks(work) : { watch: NO_WATCH_INFO, links: null };

  return {
    episodeId: episode.id as string,
    authorId: episode.user_id as string,
    title,
    lede,
    blocks,
    // 作者在校樣選定的引言優先，沒選才自動抽句
    pullQuote: episode.pull_quote ?? extractPullQuote(blocks),
    quoteAfter: pullQuotePosition(blocks),
    workTitle: work?.title ?? extractWorkTitle(title, episode.title, content.body),
    work,
    source: episode.source,
    issueNo: issueNumber(episode.id),
    issueMonth: formatIssueMonth(episode.created_at),
    date: formatDotDate(episode.created_at),
    author: displayAuthor(parseByline(episode.byline) ?? "pen_name", penName),
    publishedAt: (episode.published_at as string | null) ?? null,
    authorPath: parseByline(episode.byline) === "anonymous" ? null : authorPath(penName),
    journalLine: journal ? journalBylineLabel(journal, episode.created_at) || null : null,
    watch: box.watch,
    links: box.links,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getShareData(slug);
  if (!data) return withdrawnMetadata();
  return shareMetadata({ slug, title: data.title, description: data.lede ?? data.pullQuote, seoTitle: articleSeoTitle({ title: data.title, workTitle: data.workTitle }) });
}

function WaveBand({ variant }: { variant: "light" | "dark" }) {
  const strokes =
    variant === "light"
      ? ["stroke-ink-200", "stroke-ember", "stroke-ink-300", "stroke-ink-200"]
      : ["stroke-ink-700", "stroke-ember-soft", "stroke-ink-800"];
  const height = variant === "light" ? 76 : 64;
  const y = variant === "light" ? [22, 38, 50, 60] : [24, 38, 50];
  const amplitude = variant === "light" ? [8, 12, 6, 4] : [8, 10, 5];
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden"
      style={{ height: `${height}px` }}
    >
      <svg
        width="1360"
        height={height}
        viewBox={`0 0 1360 ${height}`}
        fill="none"
        className="block"
      >
        <path
          className={`share-wave-11s ${strokes[0]}`}
          strokeWidth="1"
          d={wavePath({ y: y[0], amplitude: amplitude[0], halfPeriod: 40, width: 1360 })}
        />
        <path
          className={`share-wave-7s ${strokes[1]}`}
          strokeWidth="1.4"
          d={wavePath({ y: y[1], amplitude: amplitude[1], halfPeriod: 30, width: 1360 })}
        />
        <path
          className={`share-wave-9s-back ${strokes[2]}`}
          strokeWidth="1"
          d={wavePath({ y: y[2], amplitude: amplitude[2], halfPeriod: 40, width: 1360, startX: -80 })}
        />
        {variant === "light" ? (
          <path
            className={`share-wave-7s ${strokes[3]}`}
            strokeWidth="1"
            d={wavePath({ y: y[3], amplitude: amplitude[3], halfPeriod: 30, width: 1360 })}
          />
        ) : null}
      </svg>
    </div>
  );
}

function recordedLineOf(data: ShareData): string {
  return data.journalLine ?? (data.source === "text" ? "散場之後寫下" : "散場之後錄下");
}

function Byline({ data }: { data: ShareData }) {
  const recordedLine = recordedLineOf(data);
  return (
    <div className="mt-6 flex items-center gap-3 border-y border-ink-200 py-3">
      {/* UX-13：署名印章跟取筆名預覽同一枚（24）；匿名不露印章 */}
      {data.authorPath ? <PenSeal penName={data.author} size={24} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-note text-ink-900">
          <span className="text-ink-600">文/</span>{data.author}
          <span className="text-ink-600"> 口述 · AI 整理</span>
        </span>
        <span className="text-caption text-ink-600">{recordedLine}</span>
      </div>
      <span className="text-caption tracking-[0.06em] text-ink-600 tabular-nums">
        {data.date}
      </span>
    </div>
  );
}

function VoiceCta({
  workTitle,
  workSlug,
}: {
  workTitle: string | null;
  workSlug: string | null;
}) {
  return (
    <section className="p4-inverse p4-band mt-14 bg-ink-950 text-paper">
      {/* 寬版（Q-60）：容器 1360、字在左鈕在右 */}
      <div className="mx-auto flex w-full max-w-[680px] flex-col px-4 pb-10 lg:grid lg:max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-16 lg:px-10 lg:pb-16">
        <div className="-mx-4 lg:col-span-full">
          <WaveBand variant="dark" />
        </div>
        <span className="mt-3 text-caption tracking-[0.2em] text-ember-soft lg:mt-6 lg:text-note lg:tracking-[0.3em]">
          換你說
        </span>
        <h2 className="mt-3 mb-0 font-serif-tc text-[26px] leading-[1.45] font-bold lg:col-start-1 lg:text-[clamp(32px,3.6vw,52px)] lg:leading-[1.35]">
          {workTitle ? <>你也看過《{workTitle}》？</> : <>你也有看完想說的話？</>}
          <br className="lg:hidden" />
          說說你的感受。
        </h2>
        <p className="mt-3 mb-0 text-[14px] leading-[1.85] text-ink-300 lg:col-start-1 lg:text-lede">
          說的或打的都行，一分鐘就好。我們幫你整理成一篇，像這篇一樣。
        </p>
        <Link
          href={workSlug ? `/say?work=${encodeURIComponent(workSlug)}` : "/say"}
          data-tour="article-cta"
          className="mt-7 flex h-[60px] items-center gap-3.5 self-start rounded-[30px] bg-paper pr-[22px] pl-2 text-[16px] font-bold text-ink-950 no-underline lg:col-start-2 lg:row-span-3 lg:row-start-2 lg:mt-0 lg:self-center lg:pr-8 lg:text-[17px]"
        >
          <span className="relative block size-11 flex-none">
            <span className="share-ring absolute inset-0 block rounded-full border-[1.5px] border-ember" />
            <span className="share-ring-delay absolute inset-0 block rounded-full border-[1.5px] border-ember" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ember-dark">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-paper"
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
            </span>
          </span>
          開始寫
        </Link>
      </div>
    </section>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getShareData(slug);
  if (!data) {
    // 文章還在但已設成私人／收回：劃掉原本的期號；完全找不到才 404
    const withdrawnIssue = await findWithdrawnIssue(slug);
    if (withdrawnIssue) return <Withdrawn issueNo={withdrawnIssue} />;
    notFound();
  }

  const category = data.workTitle ? "觀影隨筆" : "隨筆";
  const now = new Date();
  const community = communityEnabled();
  const social = community
    ? await loadArticleSocial({ ...data, workId: data.work?.id ?? null, now })
    : NO_ARTICLE_SOCIAL;

  const origin = siteOriginString();
  const jsonLd = articleJsonLd({
    origin,
    slug,
    headline: data.title,
    description: data.lede ?? data.pullQuote,
    authorName: data.author,
    authorPath: data.authorPath,
    publishedAt: data.publishedAt,
    imageUrl: `${origin}/s/${slug}/opengraph-image`,
    work: data.work ? { kind: data.work.kind, title: data.work.title, year: data.work.year } : null,
  });

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper font-sans-tc text-ink-900">
      <JsonLd data={jsonLd} />
      <div className="mx-auto w-full max-w-[680px] lg:max-w-[1440px] lg:px-10">
        <header className="mx-4 flex h-12 items-center justify-between border-b border-ink-950 lg:mx-0 lg:h-16">
          <Link
            href="/"
            className="hit-44 font-serif-tc text-[16px] font-bold tracking-[0.12em] text-ink-950 no-underline"
          >
            {BRAND}
          </Link>
          <span className="text-eyebrow tracking-[0.14em] text-ink-600">
            No.{data.issueNo} — {data.issueMonth}
          </span>
        </header>

        <div className="mt-2 lg:hidden">
          <WaveBand variant="light" />
        </div>

        {/* 桌機（Q-60 雛型 Article）：跨頁（海報＋大標）→ 左資訊欄＋右正文多欄；手機照原順序單欄，標題與署名在 lg 改由跨頁呈現 */}
        <main className="flex flex-col px-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-16 lg:px-0 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex flex-col lg:hidden">
            <div className="mt-5 flex items-center gap-2.5 text-caption tracking-[0.2em]">
              <span className="font-bold text-ember-dark">散場之後</span>
              <span aria-hidden="true" className="block h-px w-5 bg-ink-400" />
              <span className="text-ink-600">{category}</span>
            </div>

            <h1 className="mt-4 mb-0 font-serif-tc text-headline leading-[1.38] font-bold tracking-[0.01em] text-ink-950">
              {data.title}
            </h1>

            {data.lede ? (
              <p className="mt-3.5 mb-0 text-lede leading-[1.8] text-ink-700">
                {data.lede}
              </p>
            ) : null}
          </div>

          <div className="lg:hidden">
            <Byline data={data} />
          </div>

          <WideArticleSpread
            title={data.title}
            lede={data.lede}
            category={category}
            author={data.author}
            sealed={data.authorPath !== null}
            recordedLine={recordedLineOf(data)}
            date={data.date}
            work={data.work}
          />

          <div className="flex flex-col lg:col-start-2 lg:row-start-2">
            <div className="lg:hidden">
              {data.work ? (
                <WorkCard
                  title={data.work.title}
                  posterUrl={data.work.poster_url}
                  posterCredit={data.work.poster_url ? posterSourceLabel(data.work) : null}
                  metaLines={[workMetaLine(data.work)].filter(Boolean)}
                  sideLabel={posterCardLabel(data.work)}
                  href={`/works/${data.work.slug}`}
                />
              ) : data.workTitle ? (
                <WorkCard title={data.workTitle} />
              ) : null}
            </div>

            {/* 寬版正文多欄（column-width 340）、每組最多約 80vh 往下接；引言不跨欄、小標不落欄底 */}
            <ResonanceProvider slug={slug} signedIn={social.signedIn} initialMarks={social.marks}>
              <ArticleBody
                blocks={data.blocks}
                pullQuote={data.pullQuote}
                quoteAuthor={null}
                quoteAfter={data.quoteAfter}
                passageHashes={social.passageHashes}
                wideColumns
              />
            </ResonanceProvider>

            <ArticleProvenance episodeId={data.episodeId} />
            {Object.keys(social.passageHashes).length > 0 ? <ResonanceHint /> : null}

            {community ? <ReaderLetters slug={slug} authorName={data.author} /> : null}
          </div>

          <div className="lg:sticky lg:top-6 lg:col-start-1 lg:row-start-2 lg:self-start">
            <InfoBox
              workTitle={data.workTitle}
              infoRows={data.work && isOnSite(data.work) ? onSiteInfoRows(data.work) : []}
              watch={data.watch}
              links={data.links}
              podcast={Boolean(data.work && isListenKind(data.work))}
              wideMeta={data.work ? workMetaLine(data.work) : null}
            />
            {data.work ? <WideWorkLink slug={data.work.slug} /> : null}
          </div>
        </main>
      </div>

      <VoiceCta workTitle={data.workTitle} workSlug={data.work?.slug ?? null} />
      <TourMount />

      <div className="mx-auto w-full max-w-[680px] lg:max-w-[1152px] lg:px-4 xl:px-0">
        {data.work ? (
          <SameShowSection
            people={social.sameShow}
            workName={workDisplayName(data.work)}
            workKind={data.work.kind}
            verb={workVerb(data.work)}
            now={now}
          />
        ) : null}

        <footer className="mt-14 flex flex-col items-center gap-2 px-4 pt-5 pb-10">
          <span className="text-eyebrow tracking-[0.3em] text-ink-600 tabular-nums">
            — 01 —
          </span>
          <span className="font-serif-tc text-[14px] font-bold tracking-[0.12em] text-ink-950">
            {BRAND}
          </span>
          <span className="text-caption text-ink-600">
            真實的感受，比完美的評價更值得被聽見
          </span>
        </footer>
      </div>
    </div>
  );
}
