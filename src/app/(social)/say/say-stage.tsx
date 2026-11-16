"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ingestTextAction } from "@/app/(app)/episodes/new/actions";
import { startTranscriptionAction } from "@/app/(app)/episodes/[id]/actions";
import { useNavStatus } from "@/components/app-shell/nav-status";
import { WorkPickerSheet } from "@/components/work-picker/work-picker-sheet";
import { toSayWork } from "@/lib/work-picker/say-card";
import { stripPrivateWorkFields, DRAFT_VERSION, type SayDraft, type VoiceDraft } from "@/lib/say/draft";
import { quotePrefillText } from "@/lib/say/quote";
import { deriveSayTitle, formatClock, minutesSinceLabel } from "@/lib/say/stage";
import { wavePath } from "@/lib/share/wave";
import { countMeaningfulChars, MIN_MEANINGFUL_CHARS } from "@/lib/say/meaningful";
import { createSpokenEpisodeAction, discardUnheardAction } from "./actions";
import { RestoredBanner } from "./restored-banner";
import { useSayDraft } from "./use-say-draft";
import { TextPrompts } from "./text-prompts";
import { takeHoldHandoff, type HoldHandoff } from "@/lib/say/hold-handoff";
import { FallbackImg } from "@/components/ui/fallback-img";

export interface RecentWork {
  id: string;
  /** 送出時要綁定的作品（works.id）；null = 不綁定 */
  workId: string | null;
  /** 從視聽日誌進來時的紀錄 id；送出時連結到新文章 */
  journalId?: string | null;
  title: string;
  workTitle: string | null;
  categoryLabel: string;
  createdAt: string;
  /** 看完 / 聽完（預設看） */
  verb?: "看" | "聽";
  /** 作品卡副標覆寫（預帶作品時） */
  note?: string;
  posterUrl?: string | null;
}

type Mode = "voice" | "text";
type Stage = "input" | "processing";

const MIN_RECORD_SECONDS = 2;
/** 錄不到人聲（UX-02）：留在說一段，給「再說一次」與「用打的」兩個出路（Q-54） */
const NOT_HEARD_MESSAGE = "沒聽清楚，再說一次，或改用打的。";

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function MicIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
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

function KeyboardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="1.5" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  );
}

/** 錄音中/待機的三層聲波（忠實還原設計稿路徑幾何） */
function WaveBand({ recording }: { recording: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`relative mt-7 h-[110px] overflow-hidden ${recording ? "" : "shell-stage-idle"}`}
    >
      <svg width="455" height="110" viewBox="0 0 455 110" fill="none" className="block">
        <g className="shell-g3">
          <path
            className="shell-w2 stroke-ink-700"
            strokeWidth="1"
            d={wavePath({ y: 55, amplitude: 15, halfPeriod: 40, width: 520 })}
          />
        </g>
        <g className="shell-g1">
          <path
            className="shell-w1 stroke-ember"
            strokeWidth="2"
            d={wavePath({ y: 55, amplitude: 30, halfPeriod: 30, width: 510 })}
          />
        </g>
        <g className="shell-g2">
          <path
            className="shell-w3 stroke-ember-soft"
            strokeWidth="1.2"
            opacity="0.7"
            d={wavePath({ y: 55, amplitude: 17, halfPeriod: 40, width: 480, startX: -80 })}
          />
        </g>
        <g className="shell-g3">
          <path
            className="shell-w1 stroke-ink-600"
            strokeWidth="1"
            d={wavePath({ y: 55, amplitude: 8, halfPeriod: 30, width: 510 })}
          />
        </g>
      </svg>
    </div>
  );
}

function ProcessingStage({ error }: { error: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <span className="relative block size-28">
        <svg
          width="122"
          height="122"
          viewBox="0 0 122 122"
          fill="none"
          className="shell-spin absolute -top-[5px] -left-[5px]"
          aria-hidden="true"
        >
          <circle cx="61" cy="61" r="59" stroke="var(--color-ink-800)" strokeWidth="1.5" />
          <path
            d="M61 2a59 59 0 0 1 59 59"
            stroke="var(--color-ember)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-900">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ember-soft)"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 12h2M7 9v6M11 6v12M15 9v6M19 11v2" />
          </svg>
        </span>
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="m-0 font-serif-tc text-section leading-[1.5] font-bold text-paper">
          正在幫你整理…
        </h1>
        <p className="m-0 text-note leading-[1.8] text-ink-400">
          說完就可以離開。整理好之後，「我的」會亮起提醒。
        </p>
        {error ? (
          <p className="m-0 text-note leading-[1.8] text-ember-soft">{error}</p>
        ) : null}
      </div>
      <Link href="/" className="text-note tracking-[0.12em] text-ink-300 underline">
        先回首頁逛逛
      </Link>
    </div>
  );
}

export type SayDestination = "proof" | "watched";

function episodePath(destination: SayDestination, episodeId: string): string {
  return destination === "watched" ? `/watched/${episodeId}` : `/proof/${episodeId}`;
}

export function SayStage({
  works,
  initialQuote = null,
  initialMode = "voice",
  signedIn = true,
  resume = false,
  destination = "proof",
}: {
  /** 送出後去哪：校樣（預設）或「看完了」的 Threads 產出頁（/say?next=watched） */
  destination?: SayDestination;
  /** 轉錄失敗頁「改用打的」帶 ?mode=text 進來 */
  initialMode?: Mode;
  works: RecentWork[];
  /** 未登入也能說；送出時才暫存草稿並導去登入 */
  signedIn?: boolean;
  /** 登入回來（/say?resume=1）：還原剛剛的草稿 */
  resume?: boolean;
  /** 閱讀頁「引用到我的感受」帶來的句子（已清理）；有值就直接進「用打的」並預填 */
  initialQuote?: string | null;
}) {
  const router = useRouter();
  const shell = useNavStatus();
  const [mode, setMode] = useState<Mode>(initialQuote ? "text" : initialMode);
  const [stage, setStage] = useState<Stage>(() =>
    shell.status === "processing" ? "processing" : "input",
  );
  /** 從作品選擇器選定的作品；有值就蓋過預帶的 works[0] */
  const [pickedWork, setPickedWork] = useState<RecentWork | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [text, setText] = useState(() => (initialQuote ? quotePrefillText(initialQuote) : ""));
  const [errorMsg, setErrorMsg] = useState("");
  const [holding, setHolding] = useState(false);
  /** 從中央圓鈕進來、手指已放開的錄音：改成點一下完成 */
  const [latched, setLatched] = useState(false);
  /** undefined＝還沒取；null＝沒有或已接手 */
  const handoffRef = useRef<HoldHandoff | null | undefined>(undefined);
  /** 登入回來還原的錄音（等使用者按送出） */
  const [pendingVoice, setPendingVoice] = useState<VoiceDraft | null>(null);
  const [restoredKind, setRestoredKind] = useState<SayDraft["kind"] | null>(null);

  const onRestore = useCallback((draft: SayDraft) => {
    setRestoredKind(draft.kind);
    if (draft.work) setPickedWork(draft.work);
    if (draft.kind === "text") {
      setMode("text");
      setText(draft.text);
    } else {
      setMode("voice");
      setPendingVoice(draft);
    }
  }, []);
  const draft = useSayDraft(resume, onRestore);

  const mountedRef = useRef(true);
  const mediaRef = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    startedAt: number;
    commit: boolean;
  } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mediaRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const currentWork = pickedWork ?? works[0] ?? null;
  const workTitle = currentWork?.workTitle ?? null;
  const workId = currentWork?.workId ?? null;
  const journalId = currentWork?.journalId ?? null;
  const recording = shell.status === "recording";

  const goEpisode = useCallback(
    (path: string) => {
      if (mountedRef.current) router.push(path);
    },
    [router],
  );

  const submitVoice = useCallback(
    async (blob: Blob) => {
      setStage("processing");
      setErrorMsg("");
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.append(
        "audio",
        new File([blob], `say.${extension}`, { type: blob.type || "audio/webm" }),
      );
      formData.append("title", deriveSayTitle("", workTitle));
      if (workId) formData.append("workId", workId);
      if (journalId) formData.append("journalId", journalId);

      const created = await createSpokenEpisodeAction(formData);
      if (created.error || !created.episodeId) {
        shell.failProcessing(created.error ?? "上傳失敗");
        if (mountedRef.current) {
          setErrorMsg(created.error ?? "上傳失敗");
          setStage("input");
        }
        return;
      }

      // 整理中交給殼層輪詢（使用者可離開）；這裡同步等轉錄完成導頁
      shell.beginProcessing(created.episodeId);
      const result = await startTranscriptionAction(created.episodeId);
      if (result.error) {
        shell.failProcessing(`轉錄失敗：${result.error}`);
        // 校樣頁會顯示「這段沒有轉成文字」：原錄音還在，可再錄或改用打的
        goEpisode(episodePath(destination, created.episodeId));
        return;
      }
      draft.discard();
      const heard = await discardUnheardAction(created.episodeId);
      if (heard.tooShort) {
        shell.failProcessing(NOT_HEARD_MESSAGE);
        shell.consumeReady();
        if (mountedRef.current) {
          setErrorMsg(NOT_HEARD_MESSAGE);
          setStage("input");
        }
        return;
      }
      shell.finishProcessing(created.episodeId);
      shell.consumeReady();
      // 轉錄完成 → 校樣（校樣頁會接著整理成一篇）
      goEpisode(episodePath(destination, created.episodeId));
    },
    [destination, draft, goEpisode, journalId, shell, workId, workTitle],
  );

  /** 未登入：暫存草稿 → 導去登入；回來後由使用者自己按送出 */
  const stashForLogin = useCallback(
    async (content: { kind: "text"; text: string } | Omit<VoiceDraft, "version" | "savedAt" | "work">) => {
      const failed = await draft.stashAndLogin({
        ...content,
        version: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        work: stripPrivateWorkFields(currentWork),
      } as SayDraft);
      if (failed && mountedRef.current) setErrorMsg(failed);
    },
    [currentWork, draft],
  );

  const startHold = useCallback(async () => {
    if (recording || stage !== "input") return;
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      const media = {
        recorder,
        stream,
        chunks: [] as Blob[],
        startedAt: Date.now(),
        commit: false,
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) media.chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const seconds = (Date.now() - media.startedAt) / 1000;
        if (!media.commit) return;
        if (seconds < MIN_RECORD_SECONDS) {
          setErrorMsg(`再長一點：至少說 ${MIN_RECORD_SECONDS} 秒`);
          return;
        }
        const blob = new Blob(media.chunks, { type: mimeType });
        if (!signedIn) {
          void stashForLogin({ kind: "voice", audio: blob, mimeType, seconds: Math.round(seconds) });
          return;
        }
        void submitVoice(blob);
      };
      mediaRef.current = media;
      recorder.start();
      setHolding(true);
      shell.startRecording();
    } catch {
      setErrorMsg("無法使用麥克風，請確認瀏覽器權限");
    }
  }, [recording, shell, signedIn, stage, stashForLogin, submitVoice]);

  const endHold = useCallback(
    (commit: boolean) => {
      const media = mediaRef.current;
      if (!media) return;
      mediaRef.current = null;
      media.commit = commit;
      setHolding(false);
      setLatched(false);
      shell.stopRecording();
      if (media.recorder.state !== "inactive") media.recorder.stop();
    },
    [shell],
  );

  const continueHandoff = useCallback(
    async (handoff: HoldHandoff) => {
      await startHold();
      // 麥克風被拒時 startHold 已顯示錯誤，沒有錄音可接
      if (!mediaRef.current) return;
      if (handoff.released()) setLatched(true);
      else handoff.onRelease(() => endHold(true));
    },
    [endHold, startHold],
  );

  // 中央圓鈕按滿進來：直接開始錄音，省掉再按一次（只在第一次掛載時接手）
  useEffect(() => {
    if (mode !== "voice" || stage !== "input") return;
    if (handoffRef.current === undefined) handoffRef.current = takeHoldHandoff();
    const handoff = handoffRef.current;
    if (!handoff) return;
    const timer = setTimeout(() => {
      handoffRef.current = null;
      void continueHandoff(handoff);
    }, 0);
    return () => clearTimeout(timer);
  }, [continueHandoff, mode, stage]);

  const submitText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || stage !== "input") return;
    // 太短整理不成一篇（模型只會回拒絕訊息）：先請他多寫幾句（UX-02）
    if (countMeaningfulChars(trimmed) < MIN_MEANINGFUL_CHARS) {
      setErrorMsg(`再多寫幾句，至少 ${MIN_MEANINGFUL_CHARS} 個字才整理得成一篇。`);
      return;
    }
    if (!signedIn) {
      await stashForLogin({ kind: "text", text: trimmed });
      return;
    }
    setStage("processing");
    setErrorMsg("");
    shell.beginProcessing();

    const result = await ingestTextAction({
      title: deriveSayTitle(trimmed, workTitle),
      text: trimmed,
      workId,
      journalId,
    });

    if (result.error || !result.episodeId) {
      const message = result.error ?? "整理失敗，請再試一次";
      shell.failProcessing(message);
      if (result.episodeId) {
        // 生成失敗但 episode 已建：校樣頁會重試整理
        goEpisode(episodePath(destination, result.episodeId));
        return;
      }
      if (mountedRef.current) {
        setErrorMsg(message);
        setStage("input");
      }
      return;
    }

    draft.discard();
    shell.finishProcessing(result.episodeId);
    shell.consumeReady();
    goEpisode(episodePath(destination, result.episodeId));
  }, [destination, draft, goEpisode, journalId, shell, signedIn, stage, stashForLogin, text, workId, workTitle]);

  return (
    <div className="p4-inverse p4-stage fixed inset-0 z-50 overflow-hidden bg-ink-950 font-sans-tc text-paper">
      {/* 桌機：刊頭撐滿版心 1120，內容置中單欄 640；用打的展開 880（P4 版面 Token capture.column） */}
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col md:max-w-[640px] lg:max-w-[1152px] lg:px-4">
        <header className="flex h-14 flex-none items-center justify-between px-2 lg:h-16">
          <Link
            href="/"
            aria-label="關閉"
            className="flex size-11 items-center justify-center text-ink-300"
          >
            <CloseIcon />
          </Link>
          <span className="font-serif-tc text-lede font-bold tracking-[0.2em] text-paper">
            說一段
          </span>
          {stage === "input" ? (
            <button
              type="button"
              onClick={() => setMode(mode === "voice" ? "text" : "voice")}
              className="flex h-11 items-center gap-1.5 px-2.5 text-note text-ink-300"
            >
              {mode === "voice" ? (
                <>
                  <KeyboardIcon />
                  用打的
                </>
              ) : (
                <>
                  <MicIcon size={18} />
                  用說的
                </>
              )}
            </button>
          ) : (
            <span className="w-11" />
          )}
        </header>

        <div className="mx-4 border-t border-ink-800" />

        {stage === "processing" ? (
          <ProcessingStage error={shell.processingError} />
        ) : (
          <>
            <section className="flex flex-none flex-col gap-3.5 px-4 pt-5 lg:mx-auto lg:w-full lg:max-w-[672px] lg:pt-12">
              <div className="flex items-center gap-2 text-caption font-bold tracking-[0.2em] text-ember-soft">
                <span className="shell-live block size-1.5 rounded-full bg-ember" />
                {currentWork
                  ? minutesSinceLabel(currentWork.createdAt, new Date())
                  : "現在"}
              </div>
              <div className="flex items-center gap-3">
                {/* 海報載入失敗退回斜線底 */}
                <FallbackImg
                  src={currentWork?.posterUrl}
                  className="h-[50px] w-[34px] flex-none object-cover"
                  fallback={
                    <div className="flex h-[50px] w-[34px] flex-none items-center justify-center bg-[repeating-linear-gradient(135deg,var(--color-ink-800)_0_5px,var(--color-ink-900)_5px_10px)] text-[9px] text-ink-400">
                      海報
                    </div>
                  }
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-serif-tc text-prose font-bold text-paper">
                    {workTitle
                      ? `剛${currentWork?.verb ?? "看"}完《${workTitle}》`
                      : (currentWork?.title ?? "今天看了什麼？")}
                  </span>
                  <span className="truncate text-caption text-ink-400">
                    {currentWork
                      ? `${currentWork.categoryLabel} · ${currentWork.note ?? "你最近說過的"}`
                      : "之後會自動帶入你剛看完的作品"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="hit-44 min-h-11 py-3 pl-2 text-caption text-ember-soft"
                >
                  {currentWork ? "更換" : "選作品"}
                </button>
              </div>
            </section>
            <WorkPickerSheet
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={(work) => setPickedWork(toSayWork(work, new Date()))}
            />

            {restoredKind ? (
              <RestoredBanner
                kind={restoredKind}
                seconds={pendingVoice?.seconds}
                onSubmit={
                  pendingVoice
                    ? () => {
                        const audio = pendingVoice.audio;
                        setPendingVoice(null);
                        setRestoredKind(null);
                        void submitVoice(audio);
                      }
                    : undefined
                }
                onDiscard={() => {
                  draft.discard();
                  setPendingVoice(null);
                  setRestoredKind(null);
                  if (restoredKind === "text") setText("");
                }}
              />
            ) : null}

            {mode === "voice" ? (
              <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[672px]">
                <div className="px-4 pt-9">
                  <h1 className="m-0 font-serif-tc text-headline leading-[1.4] font-bold text-paper">
                    現在心裡
                    <br />
                    留下的，是什麼？
                  </h1>
                  <p className="mt-3 mb-0 text-note leading-[1.8] text-ink-400">
                    不用想好。想到什麼就說什麼，剩下的交給我們整理。
                  </p>
                </div>

                <WaveBand recording={recording} />

                <div className="min-h-[76px] px-4 pt-[18px]">
                  {recording ? (
                    <p className="m-0 font-serif-tc text-lede leading-[1.8] text-ink-300">
                      正在聽……
                      <span className="shell-live ml-1 inline-block h-[15px] w-0.5 translate-y-0.5 bg-ember-soft" />
                    </p>
                  ) : (
                    <p className="m-0 text-note leading-[1.8] text-ink-600">
                      例如：哪一幕讓你停住了？它讓你想起了誰？
                    </p>
                  )}
                </div>

                <div className="mt-auto flex flex-col items-center gap-4 px-4 pb-9">
                  {errorMsg ? (
                    <p role="alert" className="m-0 text-center text-caption text-ember-soft">
                      {errorMsg}
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg("");
                          setMode("text");
                        }}
                        className="ml-2 min-h-11 text-caption font-bold text-paper underline underline-offset-4"
                      >
                        改用打的
                      </button>
                    </p>
                  ) : null}
                  <span
                    className={`text-[17px] tracking-[0.08em] tabular-nums ${
                      recording ? "text-paper" : "text-ink-600"
                    }`}
                  >
                    {formatClock(shell.recordSeconds)}
                  </span>
                  <button
                    type="button"
                    aria-label={latched ? "完成錄音" : "按住說話"}
                    onPointerDown={latched ? () => endHold(true) : startHold}
                    onPointerUp={latched ? undefined : () => endHold(true)}
                    onPointerLeave={() => holding && !latched && endHold(false)}
                    className="relative size-28 touch-none"
                  >
                    {recording ? (
                      <>
                        <span className="shell-ring absolute inset-0 block rounded-full border-[1.5px] border-ember" />
                        <span className="shell-ring-delay absolute inset-0 block rounded-full border-[1.5px] border-ember" />
                      </>
                    ) : null}
                    <span
                      className={`absolute inset-0 flex items-center justify-center rounded-full text-paper transition-[transform,background-color] duration-200 ${
                        recording
                          ? "scale-[1.06] bg-ember shadow-[inset_0_0_0_1px_var(--color-ember-soft)]"
                          : "bg-ink-900 shadow-[inset_0_0_0_1px_var(--color-ink-700)]"
                      }`}
                    >
                      <MicIcon size={34} />
                    </span>
                  </button>
                  <span className="text-note tracking-[0.12em] text-ink-300">
                    {latched ? "點一下完成" : recording ? "放開就完成 · 移開取消" : "按住說"}
                  </span>
                  {!signedIn && !recording ? (
                    <span className="text-caption text-ink-400">放開後會請你用 email 登入，錄音會先留著</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col px-4 pt-7 pb-6 lg:mx-auto lg:grid lg:w-full lg:max-w-[912px] lg:flex-none lg:grid-cols-[minmax(0,600px)_232px] lg:content-start lg:gap-x-12 lg:[&>*]:col-start-1">
                <label
                  htmlFor="say-text"
                  className="font-serif-tc text-section leading-[1.5] font-bold text-paper"
                >
                  現在心裡留下的，是什麼？
                </label>
                <div className="mt-4 flex flex-1 border-y border-ink-800 lg:h-[380px] lg:flex-none">
                  <textarea
                    id="say-text"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="燈亮的時候……"
                    className="flex-1 resize-none border-0 bg-transparent py-4 font-serif-tc text-prose leading-[1.9] tracking-[0.03em] text-paper outline-none placeholder:text-ink-400"
                  />
                </div>
                <TextPrompts
                  onPick={(prompt) => setText((current) => (current.startsWith(prompt) ? current : `${prompt}\n${current}`))}
                  className="hidden lg:!col-start-2 lg:row-span-4 lg:row-start-2 lg:mt-4 lg:flex lg:flex-col"
                />
                <div className="mt-3 flex justify-between text-caption text-ink-400">
                  <span>寫得零碎也沒關係</span>
                  <span className="tabular-nums">{text.trim().length} 字</span>
                </div>
                {errorMsg ? (
                  <p className="mt-3 mb-0 text-caption text-ember-soft">
                    {errorMsg}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={submitText}
                  disabled={!text.trim()}
                  className="mt-5 h-[54px] flex-none rounded-[27px] bg-ember text-lede font-bold tracking-[0.1em] text-paper disabled:opacity-40 lg:w-[194px] lg:justify-self-end lg:rounded-[4px]"
                >
                  {signedIn ? "幫我整理成一篇" : "登入後整理成一篇"}
                </button>
                {!signedIn ? (
                  <p className="mt-2.5 mb-0 text-center text-caption text-ink-400">
                    會請你用 email 收一個連結登入，剛剛寫的會先留著
                  </p>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
