"use client";

/**
 * 稿紙格輸入（P3 元件特寫 03）：格 30px、11 欄＝331 寬；明體 17；預設 3 行、跟著字數長，最多 13 行，再多就捲動。
 * 畫面上的字是格子裡的鏡像（超過 140 字的格子 ember-deep＋底線＋ember-50 底），
 * 真正的輸入是疊在上面、字透明的 textarea（字距 13px，CJK 一字剛好一格）。
 */

import { useEffect, useRef, useState, type UIEvent } from "react";
import { layoutCells } from "@/lib/letters/grid";
import { GRID_MAX_ROWS } from "@/lib/letters/rules";

const CELL = 30;
const PLACEHOLDER = Array.from("想說的話，一格一字。");

interface LetterGridProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function LetterGrid({ id, label, value, onChange, disabled = false }: LetterGridProps) {
  const [focused, setFocused] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { cells, rows } = layoutCells(value);
  const scrollable = rows > GRID_MAX_ROWS;
  const height = Math.min(rows, GRID_MAX_ROWS) * CELL;
  const offset = scrollable ? scrollTop : 0;
  const hiddenRows = Math.round(offset / CELL);

  // 格子還容得下時，textarea 不該留著捲動位置（例：一次貼上又刪短）
  useEffect(() => {
    if (!scrollable && textarea.current) textarea.current.scrollTop = 0;
  }, [scrollable, rows]);
  const active = focused || value.length > 0;
  const empty = value.length === 0;

  function handleScroll(event: UIEvent<HTMLTextAreaElement>) {
    setScrollTop(event.currentTarget.scrollTop);
  }

  return (
    <div className="flex flex-col">
      {hiddenRows > 0 ? (
        <span className="mb-1.5 text-eyebrow text-ink-600">⋯ 前{hiddenRows}行已捲上去 ⋯</span>
      ) : null}
      <div
        className={`relative w-[331px] overflow-hidden border-t border-l border-ink-200 transition-shadow duration-150 motion-reduce:transition-none ${active ? "shadow-[inset_0_0_0_1px_var(--color-ink-700)]" : ""}`}
        style={{ height: height + 1, borderTopStyle: hiddenRows > 0 ? "dashed" : "solid" }}
      >
        <div
          aria-hidden="true"
          className="grid grid-cols-[repeat(11,30px)] auto-rows-[30px]"
          style={{ transform: `translateY(${-offset}px)` }}
        >
          {cells.map((cell, index) => {
            const hint = empty ? PLACEHOLDER[index] ?? "" : "";
            return (
              <span
                key={index}
                className={`flex items-center justify-center border-r border-b border-ink-200 font-serif-tc text-prose leading-none ${
                  cell.over
                    ? "bg-ember-tint text-ember-deep underline decoration-1 underline-offset-[5px]"
                    : hint
                      ? "text-ink-600"
                      : "text-ink-950"
                }`}
              >
                {cell.char || hint}
              </span>
            );
          })}
        </div>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <textarea
          ref={textarea}
          id={id}
          name="letter"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onScroll={handleScroll}
          spellCheck={false}
          className="absolute inset-0 m-0 box-border h-full w-[340px] resize-none overflow-y-auto border-0 bg-transparent p-0 pl-[6.5px] font-serif-tc text-prose leading-[30px] tracking-[13px] text-transparent caret-ember-dark outline-none [scrollbar-width:none]"
        />
      </div>
    </div>
  );
}
