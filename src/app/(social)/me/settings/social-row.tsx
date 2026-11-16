"use client";

import { useState, useTransition } from "react";
import { saveGenerateSocialAction } from "./actions";

/** check.on：ember-dark 實心 + 紙色勾；check.off：ink-600 1.5px 框 */
function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-[18px] items-center justify-center rounded-[2px] border-[1.5px] transition-colors ${
        on ? "border-ember-dark bg-ember-dark" : "border-ink-600 bg-transparent"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-paper)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={on ? "opacity-100" : "opacity-0"}>
        <path d="M5 12l5 5 9-10" />
      </svg>
    </span>
  );
}

/** 社群發文總開關（勾選列，不用開關）。各平台勾選尚無後端，暫不提供 */
export function SocialRow({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const result = await saveGenerateSocialAction(next);
      if (!result.ok) {
        setOn(!next);
        setError(result.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={toggle}
        className="grid min-h-16 w-full grid-cols-[30px_minmax(0,1fr)] items-start border-b border-ink-200 py-3 text-left"
      >
        <CheckBox on={on} />
        <span className="flex flex-col gap-0.5">
          <span className="text-lede text-ink-950">發佈時，一起寫好社群貼文</span>
          <span className="text-caption leading-[1.6] text-ink-600">寫好之後由你決定要不要貼，或排程發出去</span>
        </span>
      </button>
      {error ? (
        <p role="alert" className="mt-1 mb-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
    </>
  );
}
