"use client";

import { useEffect, useState, useTransition } from "react";
import { sendMagicLinkAction } from "@/app/auth/actions";
import { pad2, taipeiParts } from "@/lib/journal/time";

/** magicLink：60 秒後可重寄，倒數顯示在文字鈕上 */
const RESEND_SECONDS = 60;

interface LoginFormProps {
  next: string;
}

function stampTime(date: Date): string {
  const parts = taipeiParts(date);
  return `${parts.year}.${pad2(parts.month)}.${pad2(parts.day)}・${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** 每次寄出都重新掛載 SentState（key = 寄出時間），倒數從頭開始 */
function useCountdown(from: number): number {
  const [left, setLeft] = useState(from);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, from - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [from]);
  return left;
}

function SentState({
  email,
  sentAt,
  pending,
  error,
  onEdit,
  onResend,
}: {
  email: string;
  sentAt: Date;
  pending: boolean;
  error: string | null;
  onEdit: () => void;
  onResend: () => void;
}) {
  const left = useCountdown(RESEND_SECONDS);
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-4 mt-6 grid min-h-14 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 border-y border-ink-200">
        <span className="text-caption tracking-[0.1em] text-ink-600">Email</span>
        <span className="truncate font-serif-tc text-prose text-ink-950">{email}</span>
        <button type="button" onClick={onEdit} className="min-h-11 text-note text-ink-700">
          換一個
        </button>
      </div>

      <div className="mt-9 flex flex-col items-center">
        <div aria-hidden="true" className="w-[200px] -rotate-6 rounded-[4px] border-2 border-ember-dark p-1">
          <div className="flex flex-col items-center gap-1 rounded-[2px] border border-ember-dark pt-3 pb-2.5">
            <span className="pl-[0.3em] text-eyebrow tracking-[0.3em] text-ember-dark">散場誌・郵件</span>
            <span className="pl-[0.12em] font-serif-tc text-headline font-bold tracking-[0.12em] text-ember-dark">已寄出</span>
            <span className="text-caption tracking-[0.1em] text-ember-dark tabular-nums">{stampTime(sentAt)}</span>
          </div>
        </div>
        <p role="status" className="mx-4 mt-8 mb-0 text-center font-serif-tc text-prose leading-[1.8] font-bold text-ink-950">
          去信箱點一下就好，
          <br />
          這頁可以關掉。
        </p>
        <p className="mx-8 mt-2 mb-0 text-center text-note leading-[1.8] text-ink-700">
          連結一小時內有效。點開之後，這支手機上的草稿會一起跟過去。
        </p>
      </div>

      <div className="mt-auto flex flex-col items-center px-4 pt-8 pb-4">
        {error ? (
          <p role="alert" className="m-0 text-note text-ember-deep">
            {error}
          </p>
        ) : null}
        {left > 0 ? (
          <span className="flex min-h-11 items-center text-note text-ink-600 tabular-nums">沒收到？{left} 秒後可以再寄一次</span>
        ) : (
          <button type="button" onClick={onResend} disabled={pending} className="min-h-11 text-note font-bold text-ember-dark disabled:opacity-60">
            {pending ? "寄送中…" : "沒收到？再寄一次"}
          </button>
        )}
        <p className="m-0 text-center text-eyebrow leading-[1.7] text-ink-600">找不到信，看看垃圾郵件或「促銷內容」。</p>
      </div>
    </div>
  );
}

export function LoginForm({ next }: LoginFormProps) {
  /** 非受控輸入：hydrate 前就打的字不會被 React 重設成空字串（慢網路、從說一段導過來時常見） */
  const [lastEmail, setLastEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; at: Date } | null>(null);
  const [pending, startTransition] = useTransition();

  function send(email: string) {
    setError(null);
    setLastEmail(email);
    startTransition(async () => {
      const result = await sendMagicLinkAction({ email, next });
      if (result.ok) setSent({ email: email.trim(), at: new Date() });
      else setError(result.error);
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(String(new FormData(event.currentTarget).get("email") ?? ""));
  }

  if (sent) {
    return (
      <SentState
        key={sent.at.getTime()}
        email={sent.email}
        sentAt={sent.at}
        pending={pending}
        error={error}
        onEdit={() => {
          setError(null);
          setSent(null);
        }}
        onResend={() => send(sent.email)}
      />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col" noValidate>
      <label className="mx-4 mt-7 grid min-h-14 grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2 border-b border-ink-950 focus-within:border-ember-dark">
        <span className="text-caption tracking-[0.1em] text-ink-600">Email</span>
        <input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={lastEmail}
          placeholder="you@example.com"
          className="h-[52px] w-full min-w-0 border-0 bg-transparent p-0 font-serif-tc text-prose text-ink-950 caret-ember outline-none placeholder:text-ink-300"
        />
      </label>
      <p className="mx-4 mt-2.5 mb-0 text-caption leading-[1.8] text-ink-600">我們只用它寄登入連結，不寄電子報。</p>
      {error ? (
        <p role="alert" className="mx-4 mt-2 mb-0 text-note text-ember-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col px-4 pt-8 pb-4">
        <button
          type="submit"
          disabled={pending}
          className="flex h-[52px] items-center justify-center rounded-[4px] bg-ember-dark pl-[0.16em] text-lede font-bold tracking-[0.16em] text-paper disabled:opacity-60"
        >
          {pending ? "寄送中…" : "寄連結給我"}
        </button>
        <p className="mt-2.5 mb-0 text-center text-eyebrow text-ink-600">不用密碼，也不用綁社群帳號。</p>
      </div>
    </form>
  );
}
