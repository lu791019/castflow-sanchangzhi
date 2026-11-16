"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  LANG_MODES,
  parseLangMode,
  type DisplayChapter,
  type DisplaySegment,
  type LangMode,
  type ReadingMode,
} from "@/lib/listen/display";
import { activeIndexAt } from "@/lib/listen/playback";
import type { ProcessingStage } from "@/lib/listen/progress";
import type { ReadingSummaryItem } from "@/lib/reading/service";
import { MiniPlayer } from "./mini-player";
import { QuotePopover } from "./quote-popover";
import {
  ChapterList,
  ListenCta,
  ProcessingState,
  SummarySection,
} from "./reading-sections";
import { TranscriptList } from "./transcript-list";
import { useAudioPlayer } from "./use-audio-player";

const LANG_STORAGE_KEY = "castflow.listen.lang";

const MODE_TABS: Array<{ mode: ReadingMode; label: string }> = [
  { mode: "listen", label: "聽" },
  { mode: "read", label: "讀" },
  { mode: "scan", label: "掃" },
];

const MODE_HINTS: Record<ReadingMode, string> = {
  listen: "跟著播放自動捲動",
  read: "摘要在上・全文在下",
  scan: "點章節跳轉",
};

const LANG_LABELS: Record<LangMode, string> = {
  both: "對照",
  zh: "只看中文",
  source: "只看英文",
};

export interface ReadingStageProps {
  initialMode: ReadingMode;
  audioUrl: string | null;
  durationSeconds: number | null;
  readable: boolean;
  segments: DisplaySegment[];
  bilingual: boolean;
  summary: ReadingSummaryItem[];
  summaryNeedsRecompute: boolean;
  chapters: DisplayChapter[];
  processing: { stages: ProcessingStage[]; remainingMinutes: number | null; failed: boolean };
  workSlug: string | null;
  cta: { sayHref: string; prefillName: string | null; workHref: string | null; feelingCount: number };
  disclaimer: string;
}

/** 語言切換：記住使用者上次的選擇（localStorage 讀寫失敗時退回預設「對照」） */
const langListeners = new Set<() => void>();

function readStoredLang(): LangMode {
  try {
    return parseLangMode(window.localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return "both";
  }
}

function subscribeLang(listener: () => void): () => void {
  langListeners.add(listener);
  return () => langListeners.delete(listener);
}

function storeLang(mode: LangMode): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, mode);
  } catch {
    // 記不住偏好不影響閱讀；本次瀏覽仍會切換
    memoryLang = mode;
  }
  langListeners.forEach((listener) => listener());
}

let memoryLang: LangMode | null = null;

function useLangMode(): [LangMode, (mode: LangMode) => void] {
  const lang = useSyncExternalStore(
    subscribeLang,
    () => memoryLang ?? readStoredLang(),
    () => "both" as LangMode,
  );
  return [lang, storeLang];
}

function ModeTabs({
  mode,
  disabled,
  hint,
  onChange,
}: {
  mode: ReadingMode;
  disabled: boolean;
  hint: string;
  onChange: (mode: ReadingMode) => void;
}) {
  return (
    <nav aria-label="閱讀模式" className="mx-4 mt-[18px] flex items-center gap-[26px] border-b border-ink-200">
      {MODE_TABS.map((tab) => {
        const active = tab.mode === mode;
        return (
          <button
            key={tab.mode}
            type="button"
            aria-pressed={active}
            disabled={disabled && !active}
            onClick={() => onChange(tab.mode)}
            className={`flex min-h-11 items-center border-0 bg-transparent p-0 font-serif-tc text-prose ${
              active
                ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]"
                : disabled
                  ? "text-ink-300"
                  : "text-ink-600"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
      <span className="ml-auto text-eyebrow text-ink-600">{hint}</span>
    </nav>
  );
}

function LangToggle({ lang, onChange }: { lang: LangMode; onChange: (mode: LangMode) => void }) {
  return (
    <div role="radiogroup" aria-label="逐字稿語言" className="mx-4 flex items-center gap-4 text-caption">
      <span className="text-ink-600">顯示</span>
      {LANG_MODES.map((mode) => {
        const checked = mode === lang;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(mode)}
            className={`min-h-11 border-0 bg-transparent p-0 font-sans-tc text-caption ${
              checked ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
            }`}
          >
            {LANG_LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}

/** 單集閱讀頁的互動區：聽／讀／掃 三模式、雙語切換、迷你播放器、選句引用 */
export function ReadingStage(props: ReadingStageProps) {
  const { readable, segments, chapters, audioUrl } = props;
  const [mode, setMode] = useState<ReadingMode>(readable ? props.initialMode : "listen");
  const [lang, setLang] = useLangMode();
  const { audioRef, player } = useAudioPlayer(props.durationSeconds);

  const segmentStarts = useMemo(() => segments.map((segment) => segment.start), [segments]);
  const chapterStarts = useMemo(() => chapters.map((chapter) => chapter.start), [chapters]);
  const activeSegment = player.currentTime > 0 || player.playing ? activeIndexAt(segmentStarts, player.currentTime) : -1;
  const activeChapter = activeIndexAt(chapterStarts, player.currentTime);

  const changeMode = useCallback((next: ReadingMode) => {
    setMode(next);
    const url = new URL(window.location.href);
    if (next === "listen") url.searchParams.delete("mode");
    else url.searchParams.set("mode", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const seekAndPlay = useCallback((seconds: number) => player.seek(seconds, true), [player]);
  const jumpToChapter = useCallback(
    (seconds: number) => {
      player.seek(seconds, true);
      changeMode("listen");
    },
    [player, changeMode],
  );

  const showTranscript = readable && (mode === "listen" || mode === "read");

  return (
    <div className="pb-[170px]">
      <ModeTabs
        mode={mode}
        disabled={!readable}
        hint={readable ? MODE_HINTS[mode] : "逐字稿準備中"}
        onChange={changeMode}
      />

      {showTranscript && props.bilingual ? <LangToggle lang={lang} onChange={setLang} /> : null}

      {readable && mode === "read" ? (
        <SummarySection
          items={props.summary}
          needsRecompute={props.summaryNeedsRecompute}
          onSeek={seekAndPlay}
        />
      ) : null}

      {showTranscript ? (
        <TranscriptList
          segments={segments}
          langMode={props.bilingual ? lang : "both"}
          activeIndex={activeSegment}
          follow={mode === "listen" && player.playing}
          onSeek={seekAndPlay}
        />
      ) : null}

      {readable && mode === "scan" ? (
        <ChapterList chapters={chapters} activeIndex={activeChapter} onJump={jumpToChapter} />
      ) : null}

      {readable ? null : (
        <ProcessingState
          stages={props.processing.stages}
          remainingMinutes={props.processing.remainingMinutes}
          failed={props.processing.failed}
          hasAudio={Boolean(audioUrl)}
        />
      )}

      {readable ? <ListenCta {...props.cta} /> : null}

      <p className="mx-4 mt-6 mb-0 text-eyebrow leading-[1.8] whitespace-pre-line text-ink-600">
        {props.disclaimer}
      </p>

      {audioUrl ? (
        <>
          <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
          <MiniPlayer player={player} />
        </>
      ) : null}

      {readable ? <QuotePopover workSlug={props.workSlug} /> : null}
    </div>
  );
}
