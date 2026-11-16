"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildQuoteHref, normalizeQuote } from "@/lib/listen/playback";

const POPOVER_WIDTH = 220;
const POPOVER_GAP = 12;
const EDGE = 8;

interface Selected {
  quote: string;
  top: number;
  left: number;
  arrowLeft: number;
  below: boolean;
}

/** 選取範圍在逐字稿區內才算數 */
function selectionInTranscript(selection: Selection): boolean {
  const node = selection.anchorNode;
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest("[data-transcript]"));
}

function readSelection(): Selected | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  if (!selectionInTranscript(selection)) return null;
  const quote = normalizeQuote(selection.toString());
  if (!quote) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const center = rect.left + rect.width / 2;
  const left = Math.min(
    Math.max(EDGE, center - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - EDGE,
  );
  // 上方空間不足（貼近頁首）就改放在選取範圍下方
  const below = rect.top < 72;
  return {
    quote,
    top: below ? rect.bottom + POPOVER_GAP : rect.top - 44 - POPOVER_GAP,
    left,
    arrowLeft: Math.min(Math.max(14, center - left - 5), POPOVER_WIDTH - 24),
    below,
  };
}

function QuoteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" className="fill-ember-soft" aria-hidden="true">
      <path d="M7 7h4v4c0 3-1.5 5-4 6l-.8-1.4C7.6 14.8 8 13.6 8 12H7zM14 7h4v4c0 3-1.5 5-4 6l-.8-1.4c1.4-.8 1.8-2 1.8-3.6h-1z" />
    </svg>
  );
}

/** 選取逐字稿的一句 → 墨色小浮層「引用到我的感受／複製」 */
export function QuotePopover({ workSlug }: { workSlug: string | null }) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSelected(readSelection());
        setCopied(false);
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  if (!selected) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(selected.quote);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="menu"
      aria-label="引用這一句"
      // 按下浮層時不要讓瀏覽器清掉選取
      onMouseDown={(event) => event.preventDefault()}
      className="p4-inverse fixed z-50 flex items-stretch rounded-[4px] bg-ink-950"
      style={{ top: selected.top, left: selected.left, width: POPOVER_WIDTH }}
    >
      <Link
        role="menuitem"
        href={buildQuoteHref(workSlug, selected.quote)}
        className="flex min-h-11 flex-1 items-center gap-1.5 px-3.5 text-note font-bold text-paper no-underline"
      >
        <QuoteIcon />
        引用到我的感受
      </Link>
      <span aria-hidden="true" className="my-2.5 block w-px bg-ink-700" />
      <button
        type="button"
        role="menuitem"
        onClick={copy}
        className="min-h-11 border-0 bg-transparent px-3.5 font-sans-tc text-note text-ink-300"
      >
        {copied ? "已複製" : "複製"}
      </button>
      <span
        aria-hidden="true"
        className={`absolute block size-2.5 rotate-45 bg-ink-950 ${selected.below ? "-top-[5px]" : "-bottom-[5px]"}`}
        style={{ left: selected.arrowLeft }}
      />
    </div>
  );
}
