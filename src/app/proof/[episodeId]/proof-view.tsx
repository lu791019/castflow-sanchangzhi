"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  revertTarget,
  toProofDoc,
  updateTarget,
  type ProofDoc,
  type ProofTarget,
} from "@/lib/proof/document";
import type { ProofData } from "@/lib/proof/load";
import { episodeTimeLabel } from "@/lib/journal/episode-byline";
import {
  displayAuthor,
  formatDuration,
  isListed,
  nextOrdinal,
  recordedAtLabel,
  VISIBILITY_OPTIONS,
  type Byline,
  type Visibility,
} from "@/lib/proof/publish";
import type { PublishResult } from "@/lib/proof/service";
import { deriveLede, extractPullQuote } from "@/lib/share/article";
import {
  bindWorkAction,
  generateProofAction,
  publishProofAction,
  quoteCandidatesAction,
  saveDraftAction,
  saveProofBodyAction,
  selectQuoteAction,
} from "./actions";
import { ProofArticle } from "./proof-article";
import { ProofPublished } from "./proof-published";
import { PublishSettings, QuotePicker, TranscriptSection, WorkSection } from "./proof-sections";

type Busy = "idle" | "publishing" | "saving" | "regenerating";

/** 〇三 抽稿時長（exit） */
const PULL_MS = 320;

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

function transcriptMeta(data: ProofData): string {
  const { episode, transcript } = data;
  const recorded = recordedAtLabel(episode.createdAt, episode.source);
  if (episode.source === "text") return ["用打的", recorded].filter(Boolean).join("・");
  const duration = formatDuration(transcript?.durationSeconds);
  return [duration, recorded].filter(Boolean).join("・");
}

function workOrdinalNote(data: ProofData, visibility: Visibility): string | null {
  if (data.workFeelingCount === null) return null;
  if (!isListed(visibility)) {
    const label = VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? "";
    return `公開範圍是「${label}」，不會收進特輯`;
  }
  return `發佈後會成為特輯裡的第 ${nextOrdinal(data.workFeelingCount)} 段`;
}

/** 引言候選：首次進入時向引擎要 3 句（有快取直接用） */
function useQuoteCandidates(episodeId: string, initial: string[]) {
  const [candidates, setCandidates] = useState(initial);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(initial.length ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((result: Awaited<ReturnType<typeof quoteCandidatesAction>>) => {
    if (result.ok) {
      setCandidates(result.candidates);
      setStatus("ready");
    } else {
      setError(result.error);
      setStatus("error");
    }
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (started.current || initial.length) return;
    started.current = true;
    // setState 只在 promise callback 內（外部系統回應），不在 effect 本體同步觸發
    quoteCandidatesAction(episodeId, false).then(apply, (cause: unknown) =>
      apply({ ok: false, error: cause instanceof Error ? cause.message : "挑選引言失敗" }),
    );
  }, [apply, episodeId, initial.length]);

  const retry = () => {
    setStatus("loading");
    setError(null);
    quoteCandidatesAction(episodeId, true).then(apply, (cause: unknown) =>
      apply({ ok: false, error: cause instanceof Error ? cause.message : "挑選引言失敗" }),
    );
  };

  return { candidates, status, error, retry };
}

export function ProofView({ data }: { data: ProofData }) {
  const router = useRouter();
  const { episode, content } = data;
  const original = useMemo<ProofDoc>(
    () => toProofDoc(content?.originalBody ?? "", episode.title),
    [content?.originalBody, episode.title],
  );
  const [doc, setDoc] = useState<ProofDoc>(() => toProofDoc(content?.body ?? "", episode.title));
  const savedDocRef = useRef(doc);
  const [editing, setEditing] = useState<ProofTarget | null>(null);
  const [pickedQuote, setPickedQuote] = useState<string | null>(episode.pullQuote);
  const [visibility, setVisibility] = useState<Visibility>(episode.visibility);
  const [byline, setByline] = useState<Byline>(episode.byline);
  const [generateSocial, setGenerateSocial] = useState(episode.generateSocial);
  const [busy, setBusy] = useState<Busy>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workBusy, setWorkBusy] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [pulling, setPulling] = useState(false);
  const quotes = useQuoteCandidates(episode.id, episode.quoteCandidates);

  // 沒選過時預設第一句候選；候選也沒有時 fallback 自動抽句
  const selectedQuote = pickedQuote ?? quotes.candidates[0] ?? null;
  const articleQuote = selectedQuote ?? extractPullQuote(doc.blocks);

  const persistBody = useCallback(async (): Promise<boolean> => {
    if (savedDocRef.current === doc) return true;
    const result = await saveProofBodyAction(episode.id, doc);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    savedDocRef.current = doc;
    return true;
  }, [doc, episode.id]);

  const finishEditing = useCallback(async () => {
    setEditing(null);
    await persistBody();
  }, [persistBody]);

  const startEditing = (target: ProofTarget) => {
    if (editing) void persistBody();
    setEditing(target);
  };

  const onSelectQuote = async (quote: string) => {
    setPickedQuote(quote);
    const result = await selectQuoteAction(episode.id, quote);
    if (!result.ok) setError(result.error);
  };

  const settings = () => ({ visibility, byline, generateSocial, quote: selectedQuote });

  const onSaveDraft = async () => {
    setBusy("saving");
    setError(null);
    const bodyOk = await persistBody();
    const result = bodyOk ? await saveDraftAction(episode.id, settings()) : null;
    setBusy("idle");
    if (result && !result.ok) setError(result.error);
    if (result?.ok) {
      setNotice("已存草稿");
      window.setTimeout(() => setNotice(null), 2400);
    }
  };

  const onPublish = async () => {
    setBusy("publishing");
    setError(null);
    setEditing(null);
    const bodyOk = await persistBody();
    const result = bodyOk ? await publishProofAction(episode.id, settings()) : null;
    setBusy("idle");
    if (!result) return;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // P4 〇三：伺服器回應成功才抽稿——校樣往上抽走 320ms，再在空白頁蓋期號
    setPulling(true);
    window.setTimeout(() => {
      window.scrollTo({ top: 0 });
      setPublished(result.result);
    }, PULL_MS);
  };

  const onRegenerate = async () => {
    const ok = window.confirm("重新整理一版會用你原本說的內容重寫，目前的修改與引言都會被取代。確定嗎？");
    if (!ok) return;
    setBusy("regenerating");
    setError(null);
    const result = await generateProofAction(episode.id);
    setBusy("idle");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const onBind = async (workId: string | null) => {
    setWorkBusy(true);
    setWorkError(null);
    const result = await bindWorkAction(episode.id, workId);
    setWorkBusy(false);
    if (!result.ok) {
      setWorkError(result.error);
      return;
    }
    router.refresh();
  };

  if (published) {
    return (
      <ProofPublished
        episodeId={episode.id}
        title={doc.title}
        shareSlug={published.shareSlug}
        visibility={published.visibility}
        publishedAt={published.publishedAt}
        authorOrdinal={published.authorOrdinal}
        workOrdinal={published.workOrdinal}
        workTitle={data.work?.title ?? null}
        generateSocial={generateSocial}
        pullQuote={articleQuote}
        lede={deriveLede(doc.blocks).lede}
        work={data.work}
      />
    );
  }

  const author = displayAuthor(byline, data.penName);
  const typed = episode.source === "text";
  const bylineLine = `文／${author}${typed ? "・" : " 口述・"}AI 整理　${episodeTimeLabel({ createdAt: episode.createdAt, source: episode.source, journal: data.journal })}`;
  const disabled = busy !== "idle";

  return (
    <div className={`pb-[150px] lg:pb-0 ${pulling ? "p4-pull-up" : ""}`}>
      <header className="mx-4 grid h-[52px] grid-cols-[1fr_auto_1fr] items-center border-b border-ink-950 lg:mx-0 lg:h-16 lg:px-10">
        <Link href="/" className="-ml-2 flex min-h-11 items-center gap-0.5 justify-self-start text-note text-ink-950 no-underline">
          <BackIcon />
          返回
        </Link>
        <span className="pl-[0.4em] text-caption font-bold tracking-[0.4em] text-ember-dark">校樣</span>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={disabled}
          className="min-h-11 justify-self-end text-note text-ink-700 disabled:opacity-50"
        >
          {busy === "saving" ? "儲存中…" : (notice ?? "存草稿")}
        </button>
      </header>
      <p className="mx-4 mt-2.5 mb-0 text-center text-eyebrow tracking-[0.08em] text-ink-600 lg:hidden">
        AI 已整理完成・尚未發佈・只有你看得到
      </p>

      {/* 桌機（P4 版面 Token proof.split）：左 60% 校樣本體、右 40% 固定側欄；底部操作列收進側欄底部 */}
      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="lg:bg-paper-2 lg:px-8 lg:pt-6 lg:pb-16">
          <p className="mt-0 mb-4 hidden text-center text-eyebrow tracking-[0.08em] text-ink-600 lg:block">
            AI 已整理完成・尚未發佈・只有你看得到
          </p>
          <div className="lg:mx-auto lg:max-w-[704px] lg:bg-paper lg:pb-6">
            <ProofArticle
              doc={doc}
              original={original}
              editing={editing}
              byline={bylineLine}
              quote={articleQuote}
              onEdit={startEditing}
              onChange={(target, text) => setDoc((current) => updateTarget(current, target, text))}
              onRevert={(target) => setDoc((current) => revertTarget(original, current, target))}
              onDone={finishEditing}
            />
          </div>
        </div>

        <aside className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:border-l lg:border-ink-200 lg:px-6 lg:pt-6 xl:px-12">
          {data.transcript ? (
            <TranscriptSection text={data.transcript.text} meta={transcriptMeta(data)} audioUrl={episode.source === "text" ? null : episode.audioUrl} />
          ) : null}

          <QuotePicker
            candidates={quotes.candidates}
            selected={selectedQuote}
            status={quotes.status}
            error={quotes.error}
            onSelect={onSelectQuote}
            onRetry={quotes.retry}
          />

          <WorkSection
            work={data.work}
            ordinalNote={workOrdinalNote(data, visibility)}
            busy={workBusy}
            error={workError}
            onBind={onBind}
          />

          <PublishSettings
            visibility={visibility}
            byline={byline}
            penName={data.penName}
            generateSocial={generateSocial}
            onVisibility={setVisibility}
            onByline={setByline}
            onGenerateSocial={setGenerateSocial}
          />

          <p className="mx-4 mt-7 mb-0 text-center text-caption leading-[1.8] text-ink-600">
            本文由你{typed ? "寫下" : "口述"}、AI 整理。
            <br />
            確認發佈即表示這是你的意思。
          </p>

          <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-paper lg:sticky lg:mt-auto lg:border-ink-950 ${pulling ? "p4-fade-out [animation-duration:120ms]" : ""}`}>
            <div className="mx-auto flex w-full max-w-[480px] flex-col px-4 pt-3 pb-5 md:max-w-[664px] lg:max-w-none lg:px-0 lg:pt-5 lg:pb-8">
              {error ? (
                <p role="alert" className="mt-0 mb-2 text-center text-caption text-ember-deep">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onPublish}
                disabled={disabled}
                className="flex h-[52px] items-center justify-center rounded-[4px] bg-ember-dark pl-[0.2em] text-lede font-bold tracking-[0.2em] text-paper disabled:opacity-60"
              >
                {busy === "publishing" ? "發佈中…" : "確認發佈"}
              </button>
              <button
                type="button"
                onClick={onRegenerate}
                disabled={disabled}
                className="mt-1 flex min-h-11 items-center justify-center gap-1.5 text-note text-ink-700 disabled:opacity-50"
              >
                <RedoIcon />
                {busy === "regenerating" ? "正在重新整理…（約需一分鐘）" : "重新整理一版"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
