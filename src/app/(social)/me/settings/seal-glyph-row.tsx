"use client";

import { useState, useTransition } from "react";
import { Seal } from "@/components/seal/seal";
import { glyphChoices } from "@/lib/seal/glyph";
import { sealGlyph, type SealSize } from "@/lib/seal/seal";
import { saveSealGlyphAction } from "./seal-actions";

const PREVIEW_SIZES: readonly SealSize[] = [24, 40, 64];

/**
 * 印文（設計稿「P3 元件特寫 01」：作者可在設定裡換印文用字，限筆名中的字；外形不能自選）。
 * 底線式單選文字鈕＋三尺寸預覽；選了立即存，失敗退回。
 */
export function SealGlyphRow({ penName, initial }: { penName: string; initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const choices = glyphChoices(penName);
  const ruleGlyph = sealGlyph(penName);

  const pick = (next: string | null) => {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await saveSealGlyphAction(next);
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
      }
    });
  };

  const option = (key: string, label: string, next: string | null) => {
    const on = value === next;
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => pick(next)}
        className={`min-h-11 min-w-11 text-note ${on ? "font-bold text-ink-950" : "text-ink-600"}`}
      >
        <span className={`pb-[3px] font-serif-tc transition-shadow ${on ? "shadow-[var(--p2-underline-on)]" : ""}`}>{label}</span>
      </button>
    );
  };

  return (
    <div className="border-b border-ink-200 pt-3.5 pb-3">
      <div className="flex items-baseline justify-between">
        <span id="seal-glyph" className="text-lede text-ink-950">
          印文
        </span>
        <span className="text-eyebrow text-ink-600">限筆名中的字・外形不能換</span>
      </div>
      <div data-testid="seal-preview" className="mt-3 flex items-end gap-5">
        {PREVIEW_SIZES.map((size) => (
          <span key={size} className="flex flex-col items-center gap-1.5">
            <Seal penName={penName} size={size} glyph={value} />
            <span className="text-eyebrow text-ink-600 tabular-nums">{size}</span>
          </span>
        ))}
      </div>
      <div role="radiogroup" aria-labelledby="seal-glyph" className="mt-2 flex flex-wrap gap-x-4">
        {option("rule", `依規則（${ruleGlyph}）`, null)}
        {choices.map((char) => option(char, char, char))}
      </div>
      <p className="mt-0.5 mb-0 text-caption leading-[1.7] text-ink-700">
        印章外形由筆名決定，同一個筆名永遠是同一枚印；只能換刻在上面的字。
      </p>
      {error ? (
        <p role="alert" className="mt-1 mb-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
