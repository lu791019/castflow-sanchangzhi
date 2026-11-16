"use client";

import { useState, useTransition } from "react";
import { VISIBILITY_OPTIONS, type Visibility } from "@/lib/proof/publish";
import { SCOPE_HELP } from "@/lib/me/settings";
import { saveDefaultVisibilityAction } from "./actions";

/** 預設公開範圍：底線式單選文字鈕（不用 iOS 開關） */
export function ScopeRow({ initial }: { initial: Visibility }) {
  const [value, setValue] = useState<Visibility>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pick = (next: Visibility) => {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await saveDefaultVisibilityAction(next);
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
      }
    });
  };

  return (
    <div className="border-b border-ink-200 pt-3.5 pb-3">
      <div className="flex items-baseline justify-between">
        <span id="scope" className="text-lede text-ink-950">
          預設公開範圍
        </span>
        <span className="text-eyebrow text-ink-600">每一篇發佈前還能改</span>
      </div>
      <div role="radiogroup" aria-labelledby="scope" className="mt-0.5 flex gap-[22px]">
        {VISIBILITY_OPTIONS.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(option.value)}
              className={`hit-44 min-h-11 text-note ${on ? "font-bold text-ink-950" : "text-ink-600"}`}
            >
              <span className={`pb-[3px] transition-shadow ${on ? "shadow-[var(--p2-underline-on)]" : ""}`}>{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-0.5 mb-0 text-caption leading-[1.7] text-ink-700">{SCOPE_HELP[value]}</p>
      {error ? (
        <p role="alert" className="mt-1 mb-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
