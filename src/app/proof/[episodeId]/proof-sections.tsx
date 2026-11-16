"use client";

import { useRef, useState } from "react";
import { VISIBILITY_OPTIONS, type Byline, type Visibility } from "@/lib/proof/publish";
import { isSquareCover, KIND_LABELS, pickerKindForWork, type Work } from "@/lib/works/format";
import { WorkCover } from "@/components/covers/work-cover";
import { WorkPickerSheet } from "@/components/work-picker/work-picker-sheet";

function SectionHead({ eyebrow, title, className = "mb-3.5" }: { eyebrow: string; title: string; className?: string }) {
  return (
    <>
      <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">{eyebrow}</span>
      <h2 className={`mt-2 font-serif-tc text-section font-bold text-ink-950 ${className}`}>{title}</h2>
    </>
  );
}

/* ---------- 你原本說的 ---------- */

export interface TranscriptSectionProps {
  text: string;
  meta: string;
  audioUrl: string | null;
}

export function TranscriptSection({ text, meta, audioUrl }: TranscriptSectionProps) {
  const [open, setOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setAudioError(true);
    }
  };

  return (
    <section className="mx-4 mt-9 border-t border-ink-950">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center gap-2.5 text-left"
      >
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-serif-tc text-prose font-bold text-ink-950">你原本說的</span>
          <span className="text-eyebrow text-ink-600">{meta}</span>
        </span>
        <span className="text-caption text-ink-700">{open ? "收合" : "展開"}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`text-ink-700 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="border-b border-ink-200 pt-1 pb-[18px]">
          <p className="m-0 text-lede leading-[1.9] whitespace-pre-line text-ink-600">{text}</p>
          {audioUrl ? (
            <>
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="none"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onError={() => setAudioError(true)}
              />
              <button
                type="button"
                onClick={togglePlay}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-note text-ember-dark"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
                </svg>
                {playing ? "暫停" : "播放原音"}
              </button>
              {audioError ? (
                <p className="m-0 text-caption text-ember-deep">原始錄音讀取失敗，暫時無法播放。</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div className="border-b border-ink-200" />
      )}
    </section>
  );
}

/* ---------- 選一句當引言 ---------- */

export interface QuotePickerProps {
  candidates: string[];
  selected: string | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  onSelect: (quote: string) => void;
  onRetry: () => void;
}

function QuoteRow({ quote, selected, onSelect }: { quote: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-b border-ink-200 py-3.5 pr-3.5 pl-4 text-left ${
        selected
          ? "bg-ember-tint shadow-[inset_2px_0_0_var(--color-ember)]"
          : "bg-transparent active:bg-paper-2"
      }`}
    >
      <span
        className={`font-serif-tc text-prose leading-[1.6] ${selected ? "font-semibold text-ink-950" : "text-ink-800"}`}
      >
        「{quote}」
      </span>
      <span className={`pt-1 text-eyebrow ${selected ? "font-bold text-ember-deep" : "text-ink-600"}`}>
        {selected ? "已選" : "選這句"}
      </span>
    </button>
  );
}

function QuoteSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-16 flex-col justify-center gap-2 border-b border-ink-200 py-3.5 pr-3.5 pl-4">
      <span className="block h-3.5 w-[86%] bg-paper-2" />
      <span className="block h-3.5 w-[54%] bg-paper-2" />
    </div>
  );
}

export function QuotePicker({ candidates, selected, status, error, onSelect, onRetry }: QuotePickerProps) {
  const rows = selected && !candidates.includes(selected) ? [selected, ...candidates] : candidates;
  return (
    <section className="mx-4 mt-10">
      <SectionHead eyebrow="引言" title="選一句當引言" className="mb-0" />
      <p className="mt-2 mb-0 text-caption leading-[1.7] text-ink-700">
        這句會放大出現在文章中，也會成為作品特輯裡的候選共鳴句。
      </p>
      <div role="radiogroup" aria-label="引言候選" aria-busy={status === "loading"} className="mt-4 flex flex-col border-t border-ink-200">
        {rows.map((quote) => (
          <QuoteRow key={quote} quote={quote} selected={quote === selected} onSelect={() => onSelect(quote)} />
        ))}
        {status === "loading" ? (
          <>
            <QuoteSkeleton />
            <QuoteSkeleton />
            <QuoteSkeleton />
          </>
        ) : null}
      </div>
      {status === "loading" ? (
        <p className="mt-2 mb-0 text-caption text-ink-600">正在從正文挑三句候選…</p>
      ) : null}
      {status === "error" ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="m-0 text-caption leading-[1.7] text-ember-deep">
            {error ?? "挑選候選句失敗"}。沒選的話，會用自動抽出的句子。
          </p>
          <button type="button" onClick={onRetry} className="min-h-11 flex-none text-note text-ember-dark">
            再挑一次
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- 作品 ---------- */

export interface WorkSectionProps {
  work: Work | null;
  ordinalNote: string | null;
  busy: boolean;
  error: string | null;
  onBind: (workId: string | null) => void;
}

function workMeta(work: Work): string {
  if (work.kind === "podcast_episode") {
    return [
      KIND_LABELS[work.kind],
      work.podcast_show,
      work.episode_number ? `第 ${work.episode_number} 集` : null,
    ]
      .filter(Boolean)
      .join("・");
  }
  return [KIND_LABELS[work.kind], work.year ? String(work.year) : null, work.credit]
    .filter(Boolean)
    .join("・");
}

function PosterThumb({ work }: { work: Work }) {
  return (
    <WorkCover
      cover={{ kind: work.kind, title: work.podcast_show ?? work.title, posterUrl: work.poster_url, venue: work.venue, eventDate: work.event_date }}
      size={isSquareCover(work) ? "xs" : "sm"}
      className={isSquareCover(work) ? "size-12" : "h-[72px] w-12"}
    />
  );
}

export function WorkSection({ work, ordinalNote, busy, error, onBind }: WorkSectionProps) {
  const [picking, setPicking] = useState(false);
  const bind = (workId: string | null) => {
    setPicking(false);
    onBind(workId);
  };

  return (
    <section className="mx-4 mt-10">
      <SectionHead eyebrow="作品" title="這篇在說" />
      {work ? (
        <div className="flex items-center gap-3.5 border-y border-ink-200 py-3.5">
          <PosterThumb work={work} />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="font-serif-tc text-prose font-bold text-ink-950">《{work.title}》</span>
            <span className="text-caption text-ink-700">{workMeta(work)}</span>
            {ordinalNote ? <span className="text-eyebrow text-ink-600">{ordinalNote}</span> : null}
          </div>
          <button type="button" onClick={() => setPicking(!picking)} className="hit-44 flex min-h-11 items-center text-note text-ember-dark">
            更換
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-[4px] border border-dashed border-ink-400 px-4 py-5">
            <span className="font-serif-tc text-prose font-bold text-ink-950">這篇在說哪一部作品？</span>
            <span className="text-note leading-[1.75] text-ink-700">
              綁定後，文章會被收進那部作品的特輯，和其他看過的人放在一起。
            </span>
            <button
              type="button"
              onClick={() => setPicking(!picking)}
              className="mt-1.5 flex min-h-11 items-center self-start rounded-[4px] border border-ink-950 px-4 text-note font-bold text-ink-950"
            >
              選擇作品
            </button>
          </div>
          <p className="mt-2.5 mb-0 text-caption leading-[1.7] text-ember-deep">
            不綁定也可以發佈，只是不會出現在任何作品特輯裡。
          </p>
        </>
      )}
      <WorkPickerSheet
        open={picking}
        onClose={() => setPicking(false)}
        initialKind={pickerKindForWork(work)}
        onSelect={(picked) => bind(picked.id)}
      />
      {busy ? <p className="mt-2 mb-0 text-caption text-ink-600">綁定中…</p> : null}
      {error ? <p className="mt-2 mb-0 text-caption text-ember-deep">{error}</p> : null}
    </section>
  );
}

/* ---------- 發佈設定 ---------- */

export interface PublishSettingsProps {
  visibility: Visibility;
  byline: Byline;
  penName: string;
  generateSocial: boolean;
  onVisibility: (value: Visibility) => void;
  onByline: (value: Byline) => void;
  onGenerateSocial: (value: boolean) => void;
}

function UnderlineRadio({ checked, onClick, children, size = "text-lede" }: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`hit-44 min-h-11 ${size} ${
        checked ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
      }`}
    >
      {children}
    </button>
  );
}

export function PublishSettings(props: PublishSettingsProps) {
  return (
    <section className="mx-4 mt-10">
      <SectionHead eyebrow="發佈" title="發佈設定" />

      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 border-t border-ink-950 py-3.5">
        <span className="pt-3 text-note text-ink-600">公開範圍</span>
        <div role="radiogroup" aria-label="公開範圍" className="flex flex-col">
          {VISIBILITY_OPTIONS.map((option) => {
            const checked = props.visibility === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => props.onVisibility(option.value)}
                className="grid min-h-11 grid-cols-[18px_minmax(0,1fr)] gap-x-2.5 py-2.5 text-left"
              >
                <span
                  className={`mt-1 ml-[3px] block size-3 rounded-full ${
                    checked
                      ? "bg-ember shadow-[0_0_0_3px_var(--color-paper),0_0_0_4px_var(--color-ember)]"
                      : "shadow-[inset_0_0_0_1px_var(--color-ink-400)]"
                  }`}
                />
                <span className="flex flex-col gap-0.5">
                  <span className={`text-lede ${checked ? "font-bold text-ink-950" : "text-ink-900"}`}>{option.label}</span>
                  <span className={`text-caption ${checked ? "text-ink-700" : "text-ink-600"}`}>{option.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3 border-t border-ink-200 py-2">
        <span className="text-note text-ink-600">署名</span>
        <div role="radiogroup" aria-label="署名" className="flex gap-[22px]">
          <UnderlineRadio checked={props.byline === "pen_name"} onClick={() => props.onByline("pen_name")}>
            筆名・{props.penName}
          </UnderlineRadio>
          <UnderlineRadio checked={props.byline === "anonymous"} onClick={() => props.onByline("anonymous")}>
            匿名
          </UnderlineRadio>
        </div>
      </div>

      <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-3 border-y border-ink-200 py-2">
        <span className="text-note leading-[1.5] text-ink-600">社群貼文</span>
        <span className="flex min-h-11 flex-col justify-center gap-0.5">
          <span className="text-lede text-ink-950">同時產生 6 個平台</span>
          <span className="text-caption text-ink-600">Threads、Facebook、Instagram 等</span>
        </span>
        <div role="radiogroup" aria-label="同時產生社群貼文" className="flex gap-[31px]">
          <UnderlineRadio size="text-note" checked={props.generateSocial} onClick={() => props.onGenerateSocial(true)}>
            開
          </UnderlineRadio>
          <UnderlineRadio size="text-note" checked={!props.generateSocial} onClick={() => props.onGenerateSocial(false)}>
            關
          </UnderlineRadio>
        </div>
      </div>
    </section>
  );
}
