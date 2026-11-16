import Link from "next/link";
import type { ReadingSummaryItem } from "@/lib/reading/service";
import { formatChapterLength, formatClock } from "@/lib/listen/duration";
import type { DisplayChapter } from "@/lib/listen/display";
import { STAGE_SUFFIX, type ProcessingStage } from "@/lib/listen/progress";

const HIGHLIGHT_ROW =
  "-mx-4 bg-ember-tint py-3.5 pr-4 pl-3.5 shadow-[inset_2px_0_0_var(--color-ember)]";

interface SummaryProps {
  items: ReadingSummaryItem[];
  needsRecompute: boolean;
  onSeek: (seconds: number) => void;
}

/** 讀：這一集的重點（每條附時間戳，點了跳到那裡播放） */
export function SummarySection({ items, needsRecompute, onSeek }: SummaryProps) {
  return (
    <section className="mx-4 mt-4 border-t border-ink-950 pt-3.5">
      <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">這一集的重點</span>
      {items.length === 0 ? (
        <p className="mt-2 mb-0 text-note text-ink-600">這一集還沒有重點摘要。</p>
      ) : (
        <ol className="m-0 mt-2 flex list-none flex-col p-0">
          {items.map((item, index) => (
            <li
              key={`${index}-${item.text.slice(0, 8)}`}
              className="grid grid-cols-[28px_minmax(0,1fr)] border-b border-ink-50 py-3"
            >
              <span className="font-serif-tc text-lede font-bold text-ember-dark">
                {index + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-serif-tc text-prose leading-[1.65] text-ink-950">{item.text}</span>
                {item.start !== null ? (
                  <button
                    type="button"
                    onClick={() => onSeek(item.start as number)}
                    className="self-start border-0 bg-transparent p-0 font-sans-tc text-caption text-ember-dark tabular-nums"
                  >
                    {formatClock(item.start)} →
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
      {needsRecompute ? (
        <p className="mt-2 mb-0 text-eyebrow text-ink-600">時間戳待重算：這份摘要產生於加上時間戳之前。</p>
      ) : null}
      <div className="mt-7 flex items-baseline justify-between border-b border-ink-950 pb-1.5">
        <span className="font-serif-tc text-section font-bold text-ink-950">完整逐字稿</span>
        <span className="text-eyebrow text-ink-600">從頭讀起</span>
      </div>
    </section>
  );
}

interface ChapterProps {
  chapters: DisplayChapter[];
  activeIndex: number;
  onJump: (seconds: number) => void;
}

/** 掃：章節＋時間戳，目前章節用 ember-50 底＋左側燒橙線 */
export function ChapterList({ chapters, activeIndex, onJump }: ChapterProps) {
  return (
    <section aria-label="章節" className="mx-4 mt-4 border-t border-ink-950">
      {chapters.length === 0 ? (
        <p className="mt-3 mb-0 text-note text-ink-600">這一集還沒有章節。</p>
      ) : (
        chapters.map((chapter, index) => {
          const current = index === activeIndex;
          return (
            <button
              key={`${chapter.start}-${index}`}
              type="button"
              aria-current={current ? "true" : undefined}
              onClick={() => onJump(chapter.start)}
              className={`box-border grid min-h-14 grid-cols-[52px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 border-0 border-b border-solid border-ink-200 bg-transparent text-left font-sans-tc ${
                current ? `${HIGHLIGHT_ROW} w-[calc(100%+32px)]` : "w-full py-3.5"
              }`}
            >
              <span
                className={`text-note tabular-nums ${current ? "font-bold text-ember-deep" : "text-ink-700"}`}
              >
                {formatClock(chapter.start)}
              </span>
              <span
                className={`font-serif-tc text-prose leading-[1.55] text-ink-950 ${current ? "font-bold" : ""}`}
              >
                {chapter.title}
              </span>
              <span className="text-eyebrow text-ink-600 tabular-nums">
                {chapter.length !== null ? formatChapterLength(chapter.length) : ""}
              </span>
            </button>
          );
        })
      )}
      <p className="mt-3 mb-0 text-eyebrow text-ink-600">章節由 AI 依內容自動切分</p>
    </section>
  );
}

interface ProcessingProps {
  stages: ProcessingStage[];
  remainingMinutes: number | null;
  failed: boolean;
  hasAudio: boolean;
}

/** E：轉錄中——估算一律標「大約」；完成後在底部導航「我的」亮起（目前沒有推播） */
export function ProcessingState({ stages, remainingMinutes, failed, hasAudio }: ProcessingProps) {
  return (
    <section className="mx-4 mt-6">
      <div
        aria-hidden="true"
        className="mx-auto h-[240px] w-full max-w-[330px] border-r border-b border-ink-200 bg-[linear-gradient(var(--color-ink-200)_1px,transparent_1px),linear-gradient(90deg,var(--color-ink-200)_1px,transparent_1px)] bg-[size:30px_30px]"
      />
      <h2 className="mt-6 mb-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">
        {failed ? "這一集的逐字稿整理時出了問題" : "這一集正在轉錄與翻譯"}
      </h2>
      {failed ? null : (
        <p className="mt-1.5 mb-0 text-lede font-bold text-ember-dark">
          {remainingMinutes !== null ? `大約還要 ${remainingMinutes} 分鐘` : "還需要一點時間"}
        </p>
      )}
      <p className="mt-2.5 mb-0 text-note leading-[1.8] text-ink-700">
        {failed
          ? hasAudio
            ? "音檔可以先聽。"
            : "請稍後再回來看看。"
          : `好了會在『我的』亮起。${hasAudio ? "音檔已經可以先聽，" : ""}逐字稿會一段一段寫進這張稿紙。`}
      </p>
      <ol className="m-0 mt-[18px] flex list-none gap-[18px] border-t border-ink-200 p-0 pt-3 text-caption">
        {stages.map((stage) => (
          <li
            key={stage.key}
            className={
              stage.state === "active" || stage.state === "queued"
                ? "font-bold text-ember-deep"
                : stage.state === "done"
                  ? "text-ink-700"
                  : "text-ink-600"
            }
          >
            {stage.label}
            {STAGE_SUFFIX[stage.state]}
          </li>
        ))}
      </ol>
    </section>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

interface CtaProps {
  sayHref: string;
  prefillName: string | null;
  workHref: string | null;
  feelingCount: number;
}

/** 頁尾：聽完了？說一段（帶入這一集）＋ 作品特輯已有 n 段感受 */
export function ListenCta({ sayHref, prefillName, workHref, feelingCount }: CtaProps) {
  return (
    <section className="mx-4 mt-10 border-t-2 border-ink-950 pt-4">
      <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">換你說</span>
      <h2 className="mt-2 mb-0 font-serif-tc text-section font-bold text-ink-950">聽完了？說一段</h2>
      <Link
        href={sayHref}
        className="mt-4 flex h-[52px] items-center justify-center gap-2 rounded-[4px] bg-ember-dark text-lede font-bold tracking-[0.1em] text-paper no-underline"
      >
        <MicIcon />
        說一段
      </Link>
      {prefillName ? (
        <p className="mt-2 mb-0 text-center text-eyebrow text-ink-600">會自動帶入{prefillName}</p>
      ) : null}
      {workHref ? (
        <Link
          href={workHref}
          className="mt-3 flex min-h-12 items-center justify-between border-y border-ink-200 text-note text-ink-950 no-underline"
        >
          <span>這一集的作品特輯</span>
          <span className="font-bold text-ember-dark">
            {feelingCount > 0 ? `已有 ${feelingCount} 段感受 →` : "等你說第一段 →"}
          </span>
        </Link>
      ) : null}
    </section>
  );
}
