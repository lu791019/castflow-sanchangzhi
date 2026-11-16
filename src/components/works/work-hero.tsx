import { WorkCover } from "@/components/covers/work-cover";
import { VerticalDigits } from "@/components/ui/vertical-digits";
import { safeImageUrl } from "@/lib/covers/cover";
import { formatIssueNo, heroTitleStyle, isMusic, isPodcast, isSquareCover, posterCardLabel, type Work } from "@/lib/works/format";

interface WorkHeroProps {
  work: Work;
  /** 字卡上的直排大字：Podcast 用節目名，其餘用作品名 */
  cardTitle: string;
}

function IssueEyebrow({ issueNo }: { issueNo: number }) {
  return (
    <span className="text-eyebrow font-bold tracking-[0.3em] text-ember-dark [writing-mode:vertical-rl]">
      <VerticalDigits text={`作品特輯・${formatIssueNo(issueNo)}`} />
    </span>
  );
}

/** 圖說來源：影劇 TMDB、Podcast 節目封面（Apple Podcasts／RSS）、音樂專輯封面（Apple Music） */
function posterCredit(work: Work): string {
  if (isPodcast(work)) return `圖|《${work.podcast_show ?? work.title}》節目封面`;
  if (isMusic(work)) return `圖|《${work.title}》專輯封面 · Apple Music`;
  return `圖|《${work.title}》海報 · TMDB`;
}

function coverNoun(work: Work): string {
  if (isPodcast(work)) return "節目封面";
  if (isMusic(work)) return "專輯封面";
  return "海報";
}

/** 版位：海報 2:3；Podcast、音樂封面 1:1（Q-61） */
function heroBox(work: Work, hasPoster: boolean): { figure: string; cover: string } {
  if (isSquareCover(work)) {
    return hasPoster
      ? { figure: "h-[220px]", cover: "absolute top-0 right-0 size-[220px]" }
      : { figure: "", cover: "size-[200px]" };
  }
  return hasPoster
    ? { figure: "h-[330px]", cover: "absolute top-0 right-0 h-[330px] w-[220px]" }
    : { figure: "", cover: "h-[300px] w-[200px]" };
}

/** hero.poster：有海報 220×330 右側出血（載入失敗退字卡）；無海報 200×300 字卡（WorkCover）；方形封面 220／200 見 heroBox */
export function WorkHero({ work, cardTitle }: WorkHeroProps) {
  const titleStyle = heroTitleStyle(work.title);
  const hasPoster = safeImageUrl(work.poster_url) !== null;
  const cover = { kind: work.kind, title: cardTitle, posterUrl: work.poster_url };
  const box = heroBox(work, hasPoster);

  // UX-09：片名欄疊在海報後色塊之上（z-[1]），不被蓋住；長片名限高、自動換到第二欄，不伸進海報
  const verticalBlock = (
    <div className="relative z-[1] flex min-w-0 justify-end gap-3 pt-1">
      <IssueEyebrow issueNo={work.issue_no} />
      {titleStyle.vertical ? (
        <h1
          data-testid="work-hero-title"
          className="m-0 max-h-[296px] font-serif-tc text-headline leading-[1.12] font-bold text-ink-950 [writing-mode:vertical-rl]"
          style={{ letterSpacing: titleStyle.letterSpacing }}
        >
          {work.title}
        </h1>
      ) : null}
    </div>
  );

  return (
    <>
      {hasPoster ? (
        <section className="relative grid grid-cols-[minmax(0,1fr)_220px] gap-x-4 pt-7 pl-4">
          {verticalBlock}
          <figure className={`relative m-0 ${box.figure}`}>
            <div
              aria-hidden="true"
              className="work-blob absolute top-[60px] -left-[46px] h-[220px] w-[180px] bg-ember-tint-2"
            />
            <WorkCover
              cover={cover}
              size="xl"
              alt={`《${work.title}》${coverNoun(work)}`}
              eager
              mark={posterCardLabel(work)}
              className={box.cover}
            />
          </figure>
        </section>
      ) : (
        <section className="grid grid-cols-[minmax(0,1fr)_200px] gap-x-4 px-4 pt-7">
          {verticalBlock}
          <WorkCover cover={cover} size="xl" mark={posterCardLabel(work)} className={box.cover} />
        </section>
      )}

      <div className="px-4">
        <p className="mt-2.5 mb-0 text-right text-eyebrow text-ink-600">
          {hasPoster ? posterCredit(work) : `圖|尚無${coverNoun(work)}，以字卡代替`}
        </p>
        {titleStyle.vertical ? null : (
          <h1 className="mt-5 mb-0 font-serif-tc text-section leading-[1.45] font-bold break-words text-ink-950">
            {work.title}
          </h1>
        )}
      </div>
    </>
  );
}
