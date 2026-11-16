"use client";

/**
 * 「看完了」產出頁（Q-70、Q-73、Q-74、Q-78）：Threads 貼文可改、星等勾選、附作品頁連結、字數；
 * 用 Threads 開啟（網頁發文連結）或複製；短文走校樣、長文按了才產。
 * 送出後直接用 action 回傳的資料換畫面，不靠 router.refresh()（打包版 refresh 會被中斷）。
 */

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { threadsIntentUrl } from "@/lib/share/threads-post";
import { composePost, formatStars, isPostTooLong, postLength, WATCHED_THREADS_MAX_CHARS } from "@/lib/watched/post";
import { generateWatchedLongformAction, generateWatchedPostAction, publishWatchedToThreadsAction, saveWatchedPostAction } from "../actions";

interface WatchedResultProps {
  episodeId: string;
  workTitle: string | null;
  rating: number | null;
  link: string | null;
  initialPost: string | null;
  initialLongform: string | null;
  longformAvailable: boolean;
  /** 站長且已設定 Threads 權杖：主鈕改「直接發到 Threads」（Q-74 B） */
  canPostDirect: boolean;
}

type PostState = { status: "generating" } | { status: "ready" } | { status: "error"; message: string };

function useCopy(): [string, (text: string, label: string) => void] {
  const [copied, setCopied] = useState("");
  const copy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(label))
      .catch(() => setCopied("複製失敗，請手動選取"));
  };
  return [copied, copy];
}

function LongformSection({
  episodeId,
  initial,
  available,
  onCopy,
}: {
  episodeId: string;
  initial: string | null;
  available: boolean;
  onCopy: (text: string, label: string) => void;
}) {
  const [longform, setLongform] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      setError("");
      const result = await generateWatchedLongformAction(episodeId);
      if (result.ok) setLongform(result.longform);
      else setError(result.error);
    });

  if (longform) {
    return (
      <section className="flex flex-col gap-2" aria-label="長文">
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-serif-tc text-[18px] font-bold text-ink-950">長文（部落格）</h2>
          <button type="button" onClick={() => onCopy(longform, "已複製長文")} className="min-h-11 px-2 text-caption text-ember-dark">
            複製
          </button>
        </div>
        <pre className="m-0 max-h-[60vh] overflow-auto rounded-[10px] border border-ink-200 bg-paper p-3 font-sans text-[15px] leading-[1.8] whitespace-pre-wrap text-ink-900">
          {longform}
        </pre>
        <button type="button" onClick={generate} disabled={pending} className="self-start min-h-11 text-caption text-ink-600 underline">
          {pending ? "整理中…" : "再整理一版長文"}
        </button>
        {error ? <p role="alert" className="m-0 text-caption text-ember-deep">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={generate}
        disabled={!available || pending}
        className="flex min-h-14 flex-col justify-center gap-0.5 rounded-[10px] border border-ink-200 bg-paper px-3 text-left disabled:opacity-60"
      >
        <span className="text-[14px] font-medium text-ink-950">{pending ? "整理中…（約半分鐘）" : "整理成長文"}</span>
        <span className="text-caption text-ink-600">1,500～2,500 字・部落格</span>
      </button>
      {!available ? <span className="text-caption text-ink-600">原話太短，長文要多說一點（約 3 分鐘）。</span> : null}
      {error ? <p role="alert" className="m-0 text-caption text-ember-deep">{error}</p> : null}
    </div>
  );
}

export function WatchedResult(props: WatchedResultProps) {
  const { episodeId, workTitle, rating, link } = props;
  const [body, setBody] = useState(props.initialPost ?? "");
  const [state, setState] = useState<PostState>(props.initialPost ? { status: "ready" } : { status: "generating" });
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [includeRating, setIncludeRating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copied, copy] = useCopy();
  const started = useRef(false);
  const [publishing, startPublish] = useTransition();
  const [published, setPublished] = useState("");

  const generate = async () => {
    setState({ status: "generating" });
    const result = await generateWatchedPostAction(episodeId);
    if (result.ok) {
      setBody(result.post);
      setSampleCount(result.voice.sampleCount);
      setState({ status: "ready" });
    } else {
      setState({ status: "error", message: result.error });
    }
  };

  useEffect(() => {
    if (props.initialPost || started.current) return;
    started.current = true;
    void generate();
    // 只在第一次進來、還沒有稿時自動整理一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const result = await saveWatchedPostAction(episodeId, body);
    setSaveError(result.ok ? "" : result.error);
  };

  const publish = () =>
    startPublish(async () => {
      setPublished("");
      const result = await publishWatchedToThreadsAction(episodeId, composed);
      setPublished(result.ok ? "已發到 Threads" : result.error);
    });

  const composed = composePost({ body, rating, includeRating, link });
  const tooLong = isPostTooLong(composed);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-6 pb-28 lg:max-w-3xl">
      <PageHeader
        eyebrow="已存進日誌"
        title="Threads 貼文"
        description={workTitle ? `《${workTitle}》` : undefined}
        actions={
          <span className="text-caption text-ink-600" data-testid="voice-label">
            {sampleCount === null ? "" : sampleCount > 0 ? `語氣：你的・${sampleCount} 篇` : "語氣：通用"}
          </span>
        }
      />

      {sampleCount === 0 ? (
        <Link href="/me/settings/voice" className="block rounded-[10px] bg-ember-tint px-3 py-2.5 text-caption text-ember-deep no-underline">
          用的是散場誌的通用語氣。貼幾篇你自己的貼文，寫出來會更像你 →
        </Link>
      ) : null}

      {state.status === "generating" ? (
        <p className="m-0 rounded-[12px] border border-ink-200 bg-paper p-4 text-note text-ink-600" aria-live="polite">
          正在用你的語氣整理成一則 Threads……
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="flex flex-col gap-2 rounded-[12px] border border-ink-200 bg-paper p-4">
          <p role="alert" className="m-0 text-note text-ember-deep">{state.message}</p>
          <button type="button" onClick={() => void generate()} className="self-start min-h-11 text-caption text-ink-700 underline">
            再整理一次
          </button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          <div className="flex flex-col gap-2.5 rounded-[12px] border border-ink-200 bg-paper p-3.5">
            <label htmlFor="watched-post" className="text-caption text-ink-600">可以直接改</label>
            <textarea
              id="watched-post"
              data-testid="watched-post"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => void save()}
              rows={8}
              className="w-full resize-y border-0 bg-transparent text-[15px] leading-[1.7] text-ink-950"
            />
            {includeRating && rating !== null ? (
              <span className="text-[15px] text-ember" data-testid="post-stars">
                {formatStars(rating)}
              </span>
            ) : null}
            {link ? <span className="truncate text-caption text-ink-600">{link}</span> : null}
            <div className="flex items-center justify-between">
              <label className="flex min-h-11 items-center gap-2 text-caption text-ink-700">
                <input
                  type="checkbox"
                  checked={includeRating}
                  disabled={rating === null}
                  onChange={(event) => setIncludeRating(event.target.checked)}
                  className="size-[18px] accent-ember"
                />
                把星等寫進貼文{rating === null ? "（沒打星）" : ""}
              </label>
              <span className={`text-caption tabular-nums ${tooLong ? "text-ember-deep" : "text-ink-600"}`} data-testid="post-length">
                {postLength(composed)} / {WATCHED_THREADS_MAX_CHARS}
              </span>
            </div>
            {saveError ? <p role="alert" className="m-0 text-caption text-ember-deep">{saveError}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            {props.canPostDirect ? (
              <button
                type="button"
                onClick={publish}
                disabled={tooLong || publishing || published === "已發到 Threads"}
                className="flex min-h-[52px] items-center justify-center rounded-xl bg-ink-900 text-[16px] font-medium text-paper disabled:opacity-50"
              >
                {publishing ? "發送中…" : published === "已發到 Threads" ? "已發到 Threads" : "直接發到 Threads"}
              </button>
            ) : null}
            <a
              href={threadsIntentUrl(composed)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="threads-intent"
              aria-disabled={tooLong}
              className={`flex items-center justify-center rounded-xl text-[16px] font-medium no-underline ${
                props.canPostDirect ? "min-h-11 border border-ink-300 text-ink-800" : "min-h-[52px] bg-ink-900 text-paper"
              } ${tooLong ? "pointer-events-none opacity-50" : ""}`}
            >
              用 Threads 開啟
            </a>
            {published && published !== "已發到 Threads" ? (
              <p role="alert" className="m-0 text-caption text-ember-deep">{published}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy(composed, "已複製貼文")} className="min-h-11 rounded-[10px] border border-ink-300 text-[14px] text-ink-800">
                複製
              </button>
              <button type="button" onClick={() => void generate()} className="min-h-11 rounded-[10px] border border-ink-300 text-[14px] text-ink-800">
                再整理一版
              </button>
            </div>
            {tooLong ? <p className="m-0 text-caption text-ember-deep">超過 Threads 的 {WATCHED_THREADS_MAX_CHARS} 字，刪短一點才能發。</p> : null}
            <p className="m-0 min-h-5 text-caption text-ink-600" aria-live="polite">{copied}</p>
          </div>
        </>
      ) : null}

      <section className="flex flex-col gap-2 border-t border-ink-50 pt-4">
        <span className="text-caption text-ink-600">想寫多一點？</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href={`/proof/${episodeId}`}
            className="flex min-h-14 flex-col justify-center gap-0.5 rounded-[10px] border border-ink-200 bg-paper px-3 text-ink-950 no-underline"
          >
            <span className="text-[14px] font-medium">整理成短文</span>
            <span className="text-caption text-ink-600">600 字內・雜誌風，可發佈到散場誌</span>
          </Link>
          <LongformSection episodeId={episodeId} initial={props.initialLongform} available={props.longformAvailable} onCopy={copy} />
        </div>
      </section>
    </main>
  );
}
