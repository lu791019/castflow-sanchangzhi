/** 資訊欄「在哪看／在哪聽」四種狀態（server／client 皆可用：InfoBox 與讀者補連結後的即時畫面共用） */

import Link from "next/link";
import type { PlatformRow as PlatformLink, WatchInfo } from "@/lib/watch/service";
import { watchSectionView } from "@/lib/watch/view";

/** 往外開：斜箭頭 */
function OutArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

/** 留在站內：直箭頭 */
function InArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const ROW_CLASS =
  "grid min-h-[52px] items-center gap-x-3.5 border-b border-ink-200 text-ink-950 no-underline";

function PlatformRow({ platform, withNote }: { platform: PlatformLink; withNote: boolean }) {
  const columns = withNote ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]";
  const inner = (
    <>
      <span className="font-serif-tc text-prose font-bold">{platform.name}</span>
      {withNote ? <span className="text-caption text-ink-700">{platform.note}</span> : null}
      {platform.url ? (
        <span className="flex items-center gap-1 text-note font-bold text-ember-dark">
          前往
          <OutArrow />
        </span>
      ) : null}
    </>
  );
  if (!platform.url) return <div className={`${ROW_CLASS} ${columns}`}>{inner}</div>;
  return (
    <a href={platform.url} target="_blank" rel="noopener noreferrer" className={`${ROW_CLASS} ${columns}`}>
      {inner}
    </a>
  );
}

export function WatchSection({ watch, podcast, readHref }: { watch: WatchInfo; podcast: boolean; readHref: string | null }) {
  const view = watchSectionView({ podcast, info: watch, readHref });
  return (
    <>
      <div className="mt-[18px] flex items-baseline justify-between border-t border-ink-200 pt-3.5">
        <h3 className="m-0 text-lede font-bold tracking-[0.06em] text-ink-950">{view.heading}</h3>
        <span className="text-eyebrow text-ink-600">{view.headerNote}</span>
      </div>
      {view.mode === "theaters" ? (
        <div className="mt-1.5 flex min-h-16 flex-col justify-center gap-[3px] border-b border-ink-200 py-2.5">
          <span className="flex items-center gap-2 font-serif-tc text-prose font-bold text-ink-950">
            <span aria-hidden="true" className="block size-1.5 rounded-full bg-ember" />
            正在上映
          </span>
          <span className="text-caption text-ink-700">{view.theatersLine}</span>
        </div>
      ) : null}
      {view.emptyLine ? (
        <div className="mt-1.5 flex min-h-16 flex-col justify-center gap-1 border-b border-ink-200 py-3">
          <span className="font-serif-tc text-lede text-ink-800">{view.emptyLine}</span>
        </div>
      ) : null}
      {view.rows.length > 0 || view.readHref ? (
        <nav aria-label={podcast ? "收聽平台" : "串流平台"} className="mt-1.5 flex flex-col">
          {view.rows.map((platform) => (
            <PlatformRow key={platform.name} platform={platform} withNote={!podcast} />
          ))}
          {view.readHref ? (
            <Link href={view.readHref} className={`${ROW_CLASS} grid-cols-[minmax(0,1fr)_auto]`}>
              <span className="flex flex-col gap-0.5">
                <span className="text-lede font-bold">在散場誌讀逐字稿</span>
                <span className="text-eyebrow text-ink-600">中英對照・可引用</span>
              </span>
              <span className="flex items-center gap-1 text-note font-bold text-ink-950">
                讀
                <InArrow />
              </span>
            </Link>
          ) : null}
        </nav>
      ) : null}
      {view.footnote ? (
        <p className="mt-2.5 mb-0 text-eyebrow leading-[1.7] text-ink-600">{view.footnote}</p>
      ) : null}
    </>
  );
}
