"use client";

import Link from "next/link";
import { useState } from "react";
import { DESK_TAB_LABELS, DESK_TABS, deskStatLine, type DeskData, type DeskTab, type PublishedRow } from "@/lib/me/desk";
import type { ScheduleSlot } from "@/lib/me/schedule";
import { DraftList } from "./desk-drafts";
import { ScheduledList } from "./desk-scheduled";
import { DeskSocialLink } from "./desk-social-link";
import { DeskThumb } from "./desk-thumb";
import { useDeferredDelete } from "./use-deferred-delete";

const INSCRIBE = Array.from("散場之後，說一段。");

function EmptyDesk() {
  return (
    <div className="pt-6">
      <div role="img" aria-label="散場之後，說一段。" className="p2-manuscript relative h-[151px] w-full max-w-[331px]">
        <div aria-hidden="true" className="absolute top-[61px] left-[31px] flex">
          {INSCRIBE.map((char, index) => (
            <span
              key={index}
              className={`flex h-[29px] w-[30px] items-center justify-center font-serif-tc text-prose font-bold ${
                index < 4 ? "text-ink-950" : "text-ink-700"
              }`}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
      <h2 className="mt-6 mb-0 font-serif-tc text-section font-bold text-ink-950">還沒有草稿。</h2>
      <p className="mt-1.5 mb-0 text-note leading-[1.8] text-ink-700">
        說過的話會先變成草稿放在這裡；校樣好了，再決定要不要發佈。
      </p>
      <Link href="/say" className="mt-2 inline-flex min-h-11 items-center text-note font-bold text-ember-dark no-underline">
        說一段 →
      </Link>
    </div>
  );
}

function PublishedList({ rows }: { rows: PublishedRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-6 mb-0 font-serif-tc text-prose leading-[1.8] text-ink-700">還沒有發佈過。</p>;
  }
  return (
    <div className="p4-stagger">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3.5 border-b border-ink-200 py-3.5"
        >
          <DeskThumb thumb={row.thumb} />
          <span className="flex min-w-0 flex-col gap-1">
            <Link href={row.href} className="flex flex-col gap-1 text-inherit no-underline active:bg-paper-2">
              <span className="font-serif-tc text-prose leading-[1.5] font-bold text-ink-950">{row.title}</span>
              <span className="text-caption text-ink-600 tabular-nums">{row.meta}</span>
            </Link>
            <DeskSocialLink href={row.socialHref} title={row.title} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="p4-inverse fixed inset-x-4 bottom-[100px] z-40 mx-auto flex min-h-[52px] max-w-[448px] items-center gap-2.5 rounded-[4px] bg-ink-950 py-0 pr-1.5 pl-4 text-paper"
    >
      {children}
    </div>
  );
}

export function DeskView({
  desk,
  initialTab,
  slots,
  nowIso,
}: {
  desk: DeskData;
  initialTab: DeskTab;
  slots: ScheduleSlot[];
  nowIso: string;
}) {
  const [tab, setTab] = useState<DeskTab>(initialTab);
  const { hidden, toast, drop, undo, dismissError } = useDeferredDelete();
  const visible: DeskData = { ...desk, drafts: desk.drafts.filter((row) => !hidden.has(row.id)) };
  const counts: Record<DeskTab, number> = {
    drafts: visible.drafts.length,
    scheduled: visible.scheduled.length,
    published: visible.published.length,
  };
  const empty = counts.drafts + counts.scheduled + counts.published === 0 && !toast;

  const pick = (next: DeskTab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "drafts" ? "/me/desk" : `/me/desk?tab=${next}`);
  };

  return (
    <div className="pb-[120px]">
      <div className="px-4 pt-5">
        <h1 className="m-0 font-serif-tc text-headline font-bold tracking-[0.08em] text-ink-950">編輯檯</h1>
        <p className="mt-1.5 mb-0 text-note text-ink-700 tabular-nums">{deskStatLine(visible)}</p>
      </div>

      <div role="tablist" aria-label="稿件狀態" className="mx-4 mt-3.5 flex gap-[26px] border-b border-ink-200">
        {DESK_TABS.map((item) => {
          const on = item === tab;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(item)}
              className={`flex min-h-11 items-baseline gap-[5px] ${on ? "shadow-[var(--p2-underline-on)]" : ""}`}
            >
              <span className={`font-serif-tc text-prose ${on ? "font-bold text-ink-950" : "text-ink-600"}`}>
                {DESK_TAB_LABELS[item]}
              </span>
              <span className={`text-caption tabular-nums ${on ? "text-ink-700" : "text-ink-600"}`}>{counts[item]}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={DESK_TAB_LABELS[tab]} className="px-4">
        {empty ? <EmptyDesk /> : null}
        {!empty && tab === "drafts" ? <DraftList rows={visible.drafts} onDrop={drop} /> : null}
        {!empty && tab === "scheduled" ? <ScheduledList rows={visible.scheduled} slots={slots} nowIso={nowIso} /> : null}
        {!empty && tab === "published" ? <PublishedList rows={visible.published} /> : null}
      </div>

      {toast?.kind === "undo" ? (
        <Toast>
          <span className="flex-1 text-note">
            刪掉了。<span className="text-ink-300">5 秒內還可以救回來。</span>
          </span>
          <button type="button" onClick={undo} className="min-h-11 px-2.5 text-note font-bold text-ember-soft">
            復原
          </button>
        </Toast>
      ) : null}
      {toast?.kind === "error" ? (
        <Toast>
          <span className="flex-1 text-note">{toast.message}</span>
          <button type="button" onClick={dismissError} className="min-h-11 px-2.5 text-note font-bold text-ember-soft">
            知道了
          </button>
        </Toast>
      ) : null}
    </div>
  );
}
