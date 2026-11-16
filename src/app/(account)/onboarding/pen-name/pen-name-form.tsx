"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { claimLegacyDataAction, setPenNameAction } from "@/app/auth/actions";
import { SealMark } from "@/components/me/seal-mark";
import { NAME_CHECK_DEBOUNCE_MS, penNameStatus, type NameCheck } from "@/lib/me/pen-name-status";
import { validatePenName } from "@/lib/auth/pen-name-rules";

interface PenNameFormProps {
  next: string;
  initialPenName: string;
  /** 作者在設定換過的印文（只在筆名含這個字時生效，規則同 sealOf） */
  glyph?: string | null;
}

const PRIMARY_BUTTON =
  "flex h-[52px] w-full items-center justify-center rounded-[4px] pl-[0.16em] text-lede font-bold tracking-[0.16em] transition-colors disabled:opacity-60";

const TONE_CLASS = {
  hint: "text-ink-600",
  ok: "font-bold text-ember-dark",
  taken: "text-ink-700",
} as const;

async function checkName(name: string, signal: AbortSignal): Promise<NameCheck> {
  try {
    const response = await fetch(`/api/profile/pen-name/check?name=${encodeURIComponent(name)}`, { signal });
    if (!response.ok) return "unknown";
    const body = (await response.json()) as { data?: { available?: boolean } };
    return body.data?.available ? "available" : "taken";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return "unknown";
  }
}

/** 停止輸入 600ms 後查一次；結果綁定查詢字，輸入變了就視為檢查中；跟現在的筆名一樣就不查 */
function useNameCheck(name: string, current: string): NameCheck {
  const trimmed = name.trim();
  const [result, setResult] = useState<{ name: string; check: NameCheck } | null>(null);
  useEffect(() => {
    if (!validatePenName(trimmed).ok || trimmed === current.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      checkName(trimmed, controller.signal).then(
        (check) => setResult({ name: trimmed, check }),
        () => undefined,
      );
    }, NAME_CHECK_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, current]);
  return result?.name === trimmed ? result.check : "checking";
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function ClaimStep({ pending, error, onClaim, onSkip }: { pending: boolean; error: string | null; onClaim: () => void; onSkip: () => void }) {
  return (
    <section className="mx-4 mt-10 border-t border-ink-200 pt-6">
      <p className="m-0 font-serif-tc text-section font-bold text-ink-950">要接上之前的文章嗎？</p>
      <p className="mt-3 mb-0 text-note leading-[1.8] text-ink-700">
        這裡有帳號系統上線前寫下的文章與日誌。接上後它們就歸在你名下；只有第一個人能接，接了就不能再改。
      </p>
      {error ? (
        <p role="alert" className="mt-4 mb-0 text-note text-ember-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" onClick={onClaim} disabled={pending} className={`${PRIMARY_BUTTON} bg-ember-dark text-paper`}>
          {pending ? "接上中…" : "接上舊文章"}
        </button>
        <button type="button" onClick={onSkip} disabled={pending} className="min-h-11 text-note text-ink-600 underline-offset-4 hover:underline">
          不是我的，跳過
        </button>
      </div>
    </section>
  );
}

export function PenNameForm({ next, initialPenName, glyph = null }: PenNameFormProps) {
  const [penName, setPenName] = useState(initialPenName);
  const [error, setError] = useState<string | null>(null);
  const [claimStep, setClaimStep] = useState(false);
  const [pending, startTransition] = useTransition();
  const check = useNameCheck(penName, initialPenName);
  const status = penNameStatus(penName, check, initialPenName);
  const editing = initialPenName !== "";
  const trimmed = penName.trim();

  /** 整頁導向：認領後的資料、筆名都要由 server 重新渲染（也讓 proxy 重新判斷） */
  function goNext() {
    window.location.replace(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status.ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await setPenNameAction(penName);
      if (!result.ok) return setError(result.error);
      if (result.claimable) setClaimStep(true);
      else goNext();
    });
  }

  function claim() {
    setError(null);
    startTransition(async () => {
      const result = await claimLegacyDataAction();
      if (!result.ok) return setError(result.error);
      goNext();
    });
  }

  if (claimStep) return <ClaimStep pending={pending} error={error} onClaim={claim} onSkip={goNext} />;

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col" noValidate>
      <div className="flex items-start justify-between pt-6 pr-2 pl-4">
        <div className="flex flex-col gap-2 pt-1.5">
          <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">投稿單・署名</span>
          <h1 className="m-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">你的文章要署什麼名？</h1>
        </div>
        {editing ? (
          <Link href={next} aria-label="關閉" className="flex size-11 items-center justify-center text-ink-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        ) : null}
      </div>
      <p className="mx-4 mt-1 mb-0 text-note leading-[1.7] text-ink-700">{editing ? "改了之後，新的文章會用新的筆名。" : "第一次來，只問這一次。"}</p>

      <div className="mx-4 mt-5 border-t border-ink-950">
        <div className="grid min-h-16 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-x-3 border-b border-ink-950">
          <label htmlFor="pen" className="text-caption tracking-[0.14em] text-ink-600">
            署名
          </label>
          <input
            id="pen"
            name="penName"
            value={penName}
            onChange={(event) => setPenName(event.target.value)}
            placeholder="例如：林小晴"
            autoComplete="nickname"
            maxLength={40}
            className="h-[52px] w-full min-w-0 border-0 bg-transparent p-0 font-serif-tc text-section font-bold tracking-[0.04em] text-ink-950 caret-ember outline-none placeholder:font-normal placeholder:text-ink-300"
          />
          <SealMark name={penName} size={40} glyph={glyph} />
        </div>
        <div role="status" aria-live="polite" className={`flex min-h-9 items-center gap-1.5 text-note ${TONE_CLASS[status.tone]}`}>
          {status.tone === "ok" ? <CheckIcon /> : null}
          <span>{status.text}</span>
        </div>
      </div>

      <div className="mx-4 mt-3.5">
        <span className="text-eyebrow font-bold tracking-[0.2em] text-ink-600">會這樣印在文章上</span>
        <div className="mt-2 grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-2.5 border-y border-ink-200 py-3">
          <SealMark name={penName} size={24} glyph={glyph} />
          <span className="min-w-0 text-note text-ink-900">
            <span className="text-ink-600">文／</span>
            <span className={trimmed ? "text-ink-900" : "text-ink-300"}>{trimmed || "＿＿＿＿"}</span>
            <span className="text-ink-600">　口述・AI 整理</span>
          </span>
        </div>
        <p className="mt-3 mb-0 text-caption leading-[1.8] text-ink-600">
          之後可以在「設定」改。不想署名也沒關係：校樣頁的「署名」可以選匿名，那一篇就不會出現筆名。
        </p>
      </div>

      {error ? (
        <p role="alert" className="mx-4 mt-3 mb-0 text-note text-ember-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-auto px-4 pt-8 pb-3.5">
        <button
          type="submit"
          aria-disabled={!status.ready}
          disabled={pending || status.unchanged}
          className={`${PRIMARY_BUTTON} ${status.ready ? "bg-ember-dark text-paper" : "bg-ink-50 text-ink-600"}`}
        >
          {pending ? "儲存中…" : status.buttonLabel}
        </button>
      </div>
    </form>
  );
}
