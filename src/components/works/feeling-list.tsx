import Link from "next/link";
import { avatarInitial, relativeTimeLabel, stripWorkTitle } from "@/lib/works/format";
import type { WorkFeeling } from "@/lib/works/repository";

interface FeelingListProps {
  feelings: WorkFeeling[];
  workTitle: string;
  now: Date;
}

const LIST_PREVIEW = 4;

function EmptySlot() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3 border-b border-dashed border-ink-300 py-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="box-border block size-7 flex-none rounded-full border border-dashed border-ink-300" />
        <span className="flex-1 text-note text-ink-600">你的名字</span>
        <span className="text-caption text-ink-600">現在</span>
      </div>
      <div className="mt-1.5 h-px w-[82%] bg-ink-200" />
      <div className="mt-2.5 h-px w-[56%] bg-ink-50" />
    </div>
  );
}

/** 感受列表：去作品名、突出作者與引句；零感受時顯示「你的名字」虛線佔位 */
export function FeelingList({ feelings, workTitle, now }: FeelingListProps) {
  const preview = feelings.slice(0, LIST_PREVIEW);
  return (
    <section className={feelings.length === 0 ? "mt-11" : "mt-[52px]"}>
      <div className="flex items-baseline justify-between border-b border-ink-950 pb-2.5">
        <h2 className="m-0 font-serif-tc text-section font-bold text-ink-950">
          {feelings.length} 段感受
        </h2>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">依發表時間</span>
      </div>

      {feelings.length === 0 ? <EmptySlot /> : null}

      {preview.map((feeling) => (
        <Link
          key={feeling.episodeId}
          href={`/s/${feeling.shareSlug}`}
          className="flex flex-col gap-2 border-b border-ink-200 py-5 text-inherit no-underline"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-ink-50 font-serif-tc text-note font-bold text-ink-800">
              {avatarInitial(feeling.author)}
            </span>
            <span className="min-w-0 flex-1 truncate text-note font-bold text-ink-950">
              {feeling.author}
            </span>
            <span className="text-caption text-ink-600 tabular-nums">
              {relativeTimeLabel(feeling.publishedAt, now)}
            </span>
          </div>
          <span className="font-serif-tc text-prose leading-[1.55] font-bold text-ink-950">
            {stripWorkTitle(feeling.title, workTitle)}
          </span>
          {feeling.pullQuote ? (
            <span className="text-note leading-[1.75] text-ink-700">
              「{feeling.pullQuote}」
            </span>
          ) : null}
        </Link>
      ))}

      {feelings.length > LIST_PREVIEW ? (
        // TODO(works): 全部感受分頁尚未實作
        <span className="mt-1 inline-flex min-h-11 items-center text-note font-bold text-ember-dark">
          讀全部 {feelings.length} 段（即將開放）
        </span>
      ) : null}
    </section>
  );
}
