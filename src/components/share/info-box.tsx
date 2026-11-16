import { ListenWorkLinks } from "@/components/links/listen-work-links";
import { LiveWorkLinks } from "@/components/links/live-work-links";
import type { InfoBoxLinks } from "@/lib/links/info-box";
import { isListenWorkKind } from "@/lib/links/listen";
import type { WatchInfo } from "@/lib/watch/service";
import { WatchSection } from "./watch-section";

interface InfoBoxProps {
  workTitle?: string | null;
  infoRows?: Array<{ label: string; value: string }>;
  /** 在哪看／在哪聽資料；null = 不顯示該區（演出／展覽） */
  watch: WatchInfo | null;
  podcast?: boolean;
  /** Podcast：站內單集閱讀頁（「在散場誌讀逐字稿」） */
  readHref?: string | null;
  /** 在哪看／去哪買票／官網的合併連結（買票區、缺口補資料）；null = 不顯示 */
  links?: InfoBoxLinks | null;
  /** 寬版（≥1024，Q-60）作品卡藏起來，年份／地區／導演改放片名下；窄版不顯示 */
  wideMeta?: string | null;
}

/** INFO 資訊欄：作品資料 +「在哪看／在哪聽」四種狀態 */
export function InfoBox({ workTitle, infoRows = [], watch, podcast = false, readHref = null, links = null, wideMeta = null }: InfoBoxProps) {
  return (
    <section className="mt-12 border-t-2 border-ink-950">
      <div className="flex items-baseline justify-between pt-3">
        <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">資訊欄</span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">INFO</span>
      </div>
      {workTitle ? (
        <h2 className="mt-2.5 mb-0 font-serif-tc text-section font-bold text-ink-950">《{workTitle}》</h2>
      ) : null}
      {wideMeta ? <p className="mt-1 mb-0 hidden text-note leading-[1.8] text-ink-600 lg:block">{wideMeta}</p> : null}
      {infoRows.length > 0 ? (
        <dl className="mt-3.5 mb-0 grid grid-cols-[56px_minmax(0,1fr)] gap-y-2 text-note leading-[1.6]">
          {infoRows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-ink-600">{row.label}</dt>
              <dd className="m-0 text-ink-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {links && watch && isListenWorkKind(links.workKind) ? (
        <ListenWorkLinks workId={links.workId} workKind={links.workKind} watch={watch} spotify={links.spotify} readHref={readHref} />
      ) : links ? (
        <LiveWorkLinks workId={links.workId} workKind={links.workKind} links={links.view} watch={watch} podcast={podcast} readHref={readHref} />
      ) : watch ? (
        <WatchSection watch={watch} podcast={podcast} readHref={readHref} />
      ) : null}
    </section>
  );
}
