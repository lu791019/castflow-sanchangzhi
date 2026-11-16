"use client";

/** 排隊中的一篇：抓取中／錯誤／已經搬過了／確認卡／搬好了 */

import Link from "next/link";
import { useState } from "react";
import { formatDotDate, type ArticleBlock } from "@/lib/share/article";
import type { QueueItem, QueueState } from "@/lib/import/queue";
import type { ImportPreview } from "@/lib/import/types";
import type { PickerWork } from "@/lib/work-picker/types";
import { requestCommit } from "./client";
import { WorkChoice } from "./work-choice";

const CARD = "border-t-2 border-ink-950 pt-3 pb-6";

function UrlLine({ url }: { url: string }) {
  return <p className="m-0 truncate text-caption text-ink-600">{url}</p>;
}

function Excerpt({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="mt-3 flex flex-col gap-2 border-l-2 border-ink-200 pl-3">
      {blocks.map((block, index) => (
        <p key={index} className={`m-0 line-clamp-3 font-serif-tc text-note leading-[1.8] ${block.type === "heading" ? "font-bold text-ink-950" : "text-ink-800"}`}>
          {block.type === "list" ? block.items.join("、") : block.text}
        </p>
      ))}
    </div>
  );
}

function PreviewHead({ preview }: { preview: ImportPreview }) {
  const date = preview.publishedAt ? formatDotDate(preview.publishedAt) : null;
  return (
    <>
      <p className="m-0 text-eyebrow tracking-[0.14em] text-ink-600 tabular-nums">
        {preview.domain}
        {date ? `・原文 ${date}` : "・原文沒有日期，會用今天"}
      </p>
      <div className={`mt-2 grid items-start gap-x-3 ${preview.imageUrl ? "grid-cols-[minmax(0,1fr)_64px]" : ""}`}>
        <h2 className="m-0 font-serif-tc text-section leading-[1.4] font-bold text-ink-950">{preview.title}</h2>
        {preview.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 原文首圖（外部網址，只在確認卡預覽）
          <img src={preview.imageUrl} alt="" referrerPolicy="no-referrer" className="block h-16 w-16 object-cover" />
        ) : null}
      </div>
      <Excerpt blocks={preview.excerpt} />
      <p className="mt-2 mb-0 text-caption text-ink-600 tabular-nums">全文 {preview.charCount} 字</p>
    </>
  );
}

function ConfirmCard({ preview, onDone }: { preview: ImportPreview; onDone: (state: QueueState) => void }) {
  const [work, setWork] = useState<PickerWork | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = Boolean(work) && confirmed && !busy;

  const submit = async () => {
    if (!work || !canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await requestCommit({ url: preview.url, workId: work.id, confirmed });
    if (result.kind === "error") {
      setError(result.error);
      setBusy(false);
      return;
    }
    onDone(result);
  };

  return (
    <article aria-label={preview.title} className={CARD}>
      <PreviewHead preview={preview} />
      <h3 className="mt-6 mb-0 font-serif-tc text-prose font-bold text-ink-950">這篇在談哪一部？</h3>
      <WorkChoice guess={preview.guess} chosen={work} onChosen={setWork} />
      <label className="mt-5 flex min-h-11 items-center gap-3 text-lede text-ink-950">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="size-5 flex-none accent-[var(--color-ember-dark)]"
        />
        這是我寫的文章
      </label>
      <p className="mt-1 mb-0 text-caption leading-[1.8] text-ink-600">搬進來後以筆名公開發佈，文章底下會註明原文出處。</p>
      {error ? <p className="mt-2 mb-0 text-caption text-ember-deep">{error}</p> : null}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="mt-4 h-[52px] w-full rounded-[4px] bg-ember-dark text-lede font-bold tracking-[0.1em] text-paper disabled:opacity-50"
      >
        {busy ? "搬運中…" : "搬進來並發佈"}
      </button>
    </article>
  );
}

function StatusCard({ item, children }: { item: QueueItem; children: React.ReactNode }) {
  return (
    <article aria-label={item.rawUrl} className={CARD}>
      <UrlLine url={item.rawUrl} />
      {children}
    </article>
  );
}

export function ImportCard({
  item,
  loading,
  onState,
  onRemove,
}: {
  item: QueueItem;
  loading: boolean;
  onState: (state: QueueState) => void;
  onRemove: () => void;
}) {
  const { state } = item;
  switch (state.kind) {
    case "ready":
      return <ConfirmCard preview={state.preview} onDone={onState} />;
    case "queued":
    case "loading":
      return (
        <StatusCard item={item}>
          <p className="mt-2 mb-0 text-note text-ink-700">{loading || state.kind === "loading" ? "讀取文章中…" : "排隊中"}</p>
        </StatusCard>
      );
    case "duplicate":
      return (
        <StatusCard item={item}>
          <p className="mt-2 mb-0 text-note text-ink-950">已經搬過了。</p>
          <Link href={state.existing.href} className="inline-flex min-h-11 items-center text-note font-bold text-ember-dark no-underline">
            {state.existing.title ? `看〈${state.existing.title}〉` : "看那一篇"} →
          </Link>
        </StatusCard>
      );
    case "done":
      return (
        <StatusCard item={item}>
          <p className="mt-2 mb-0 text-note text-ink-950">搬好了，已發佈。</p>
          <Link href={state.article.href} className="inline-flex min-h-11 items-center text-note font-bold text-ember-dark no-underline">
            看〈{state.article.title}〉 →
          </Link>
        </StatusCard>
      );
    case "error":
      return (
        <StatusCard item={item}>
          <p role="alert" className="mt-2 mb-0 text-note text-ember-deep">
            {state.error}
          </p>
          <button type="button" onClick={onRemove} className="min-h-11 text-note text-ink-700">
            移除
          </button>
        </StatusCard>
      );
  }
}
