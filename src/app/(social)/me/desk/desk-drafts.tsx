"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { DraftRow } from "@/lib/me/desk";
import { DeskSocialLink } from "./desk-social-link";
import { DeskThumb } from "./desk-thumb";

const LONG_PRESS_MS = 550;

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/** 列內二次確認（confirm.surface）：安全選項「留著」是外框鈕，破壞性動作是安靜的底線字 */
function DeleteConfirm({ onKeep, onDrop }: { onKeep: () => void; onDrop: () => void }) {
  return (
    <div role="alert" className="mt-3 ml-[62px] border-t border-dashed border-ink-300 pt-3">
      <p className="m-0 font-serif-tc text-lede font-bold text-ink-950">刪除這份草稿？</p>
      <p className="mt-1 mb-0 text-caption leading-[1.7] text-ink-700">原錄音和整理好的文字會一起刪掉，刪了就找不回來。</p>
      <div className="mt-2 flex items-center gap-5">
        <button type="button" onClick={onKeep} className="min-h-9 rounded-[4px] border border-ink-950 bg-paper px-4 text-note font-bold text-ink-950">
          留著
        </button>
        <button type="button" onClick={onDrop} className="min-h-11 text-note text-ink-700 underline underline-offset-[3px]">
          刪除
        </button>
      </div>
    </div>
  );
}

function DraftItem({
  row,
  menuOpen,
  confirming,
  onMenu,
  onAsk,
  onKeep,
  onDrop,
}: {
  row: DraftRow;
  menuOpen: boolean;
  confirming: boolean;
  onMenu: () => void;
  onAsk: () => void;
  onKeep: () => void;
  onDrop: () => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      onAsk();
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div className={`relative border-b border-ink-200 ${confirming ? "-mx-4 bg-paper-2 p-4" : "py-4"}`}>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_44px] items-start gap-x-3.5">
        <DeskThumb thumb={row.thumb} />
        <Link
          href={row.href}
          className="flex min-w-0 flex-col gap-1 text-inherit no-underline"
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (longPressed.current) event.preventDefault();
          }}
        >
          <span className="text-eyebrow tracking-[0.1em] text-ink-600">{row.eyebrow}</span>
          <span className="font-serif-tc text-prose leading-[1.5] font-bold text-ink-950">{row.title}</span>
          <span className="flex items-center gap-2 text-caption text-ink-600">
            <span className="text-ink-700">{row.status}</span>
            {row.half ? (
              <span aria-hidden="true" className="block h-0.5 w-8 bg-ink-200">
                <span className="block h-0.5 w-4 bg-ember" />
              </span>
            ) : null}
            <span className="tabular-nums">{row.time}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onMenu}
          aria-label={`更多：${row.title}`}
          aria-expanded={menuOpen}
          className="-mr-2.5 flex size-11 items-center justify-center text-ink-700"
        >
          <MoreIcon />
        </button>
      </div>
      {row.socialHref ? (
        <div className="pl-[62px]">
          <DeskSocialLink href={row.socialHref} title={row.title} />
        </div>
      ) : null}
      {menuOpen ? (
        <div role="menu" className="p4-inverse absolute top-[54px] right-0 z-10 flex w-[168px] flex-col rounded-[4px] bg-ink-950 py-1">
          <Link role="menuitem" href={row.href} className="flex min-h-11 items-center px-4 text-note text-paper no-underline">
            繼續校樣
          </Link>
          <span aria-hidden="true" className="mx-4 my-1 block h-px bg-ink-700" />
          <button role="menuitem" type="button" onClick={onAsk} className="min-h-11 px-4 text-left text-note text-ember-soft">
            刪除草稿…
          </button>
        </div>
      ) : null}
      {confirming ? <DeleteConfirm onKeep={onKeep} onDrop={onDrop} /> : null}
    </div>
  );
}

export function DraftList({ rows, onDrop }: { rows: DraftRow[]; onDrop: (id: string) => void }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);

  return (
    <div className="p4-stagger" onKeyDown={(event) => event.key === "Escape" && setMenuFor(null)}>
      {rows.map((row) => (
        <DraftItem
          key={row.id}
          row={row}
          menuOpen={menuFor === row.id}
          confirming={confirmFor === row.id}
          onMenu={() => {
            setConfirmFor(null);
            setMenuFor(menuFor === row.id ? null : row.id);
          }}
          onAsk={() => {
            setMenuFor(null);
            setConfirmFor(row.id);
          }}
          onKeep={() => setConfirmFor(null)}
          onDrop={() => {
            setConfirmFor(null);
            onDrop(row.id);
          }}
        />
      ))}
      {menuFor === null && confirmFor === null ? (
        <p className="mt-3.5 mb-0 text-eyebrow leading-[1.7] text-ink-600">草稿只有你看得到。長按一列，也可以刪除。</p>
      ) : null}
    </div>
  );
}
