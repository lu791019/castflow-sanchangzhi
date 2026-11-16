"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { scheduleWhenLabel, timeLeftLabel, type ScheduledRow } from "@/lib/me/desk";
import { isScheduleLocked, parseTaipeiLocal, toTaipeiLocal, type ScheduleSlot } from "@/lib/me/schedule";
import { cancelScheduleAction, rescheduleAction } from "./actions";
import { DeskSocialLink } from "./desk-social-link";
import { DeskThumb } from "./desk-thumb";

const CUSTOM = "custom";
const UNDERLINE_ON = "shadow-[var(--p2-underline-on)]";

function TimePanel({ row, slots, onDone }: { row: ScheduledRow; slots: ScheduleSlot[]; onDone: () => void }) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>(slots[0]?.iso ?? CUSTOM);
  const [custom, setCustom] = useState(toTaipeiLocal(row.scheduledAt));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const iso = choice === CUSTOM ? parseTaipeiLocal(custom) : choice;
    if (!iso) return setError("時間格式不對");
    setError(null);
    startTransition(async () => {
      const result = await rescheduleAction(row.id, iso);
      if (!result.ok) return setError(result.error);
      onDone();
      router.refresh();
    });
  };

  const options = [...slots.map((slot) => ({ value: slot.iso, label: slot.label })), { value: CUSTOM, label: "自己選…" }];
  return (
    <div className="mt-1.5 ml-[62px] border-t border-dashed border-ink-300 pt-3">
      <span id={`nt-${row.id}`} className="text-eyebrow font-bold tracking-[0.2em] text-ink-600">
        改到什麼時候
      </span>
      <div role="radiogroup" aria-labelledby={`nt-${row.id}`} className="mt-0.5 grid grid-cols-2 gap-x-3">
        {options.map((option) => {
          const on = option.value === choice;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(option.value)}
              className={`min-h-11 text-left text-note tabular-nums ${on ? "font-bold text-ink-950" : "text-ink-700"}`}
            >
              <span className={`pb-[3px] ${on ? UNDERLINE_ON : ""}`}>{option.label}</span>
            </button>
          );
        })}
      </div>
      {choice === CUSTOM ? (
        <input
          type="datetime-local"
          aria-label="自己選時間"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          className="mb-2 h-11 w-full border-0 border-b border-ink-950 bg-transparent font-serif-tc text-lede text-ink-950 outline-none"
        />
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 mb-2 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-1 min-h-9 rounded-[4px] border border-ink-950 px-4 text-note font-bold text-ink-950 disabled:opacity-60"
      >
        {pending ? "存檔中…" : "改好了"}
      </button>
    </div>
  );
}

function CancelPanel({ row, onKeep }: { row: ScheduledRow; onKeep: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      const result = await cancelScheduleAction(row.id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  const lead = row.published ? "文章留在原處" : "這篇會回到草稿";
  return (
    <div role="alert" className="mt-1.5 ml-[62px] border-t border-dashed border-ink-300 pt-3">
      <p className="m-0 font-serif-tc text-lede font-bold text-ink-950">取消排程？</p>
      <p className="mt-1 mb-0 text-caption leading-[1.7] text-ink-700">
        {lead}，{row.platforms} 的貼文也不會發出去。
      </p>
      {error ? <p className="mt-1 mb-0 text-caption text-ember-deep">{error}</p> : null}
      <div className="mt-2 flex items-center gap-5">
        <button type="button" onClick={onKeep} className="min-h-9 rounded-[4px] border border-ink-950 px-4 text-note font-bold text-ink-950">
          先留著
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="min-h-11 text-note text-ink-700 underline underline-offset-[3px] disabled:opacity-60"
        >
          確定取消
        </button>
      </div>
    </div>
  );
}

function ScheduledItem({ row, slots, now }: { row: ScheduledRow; slots: ScheduleSlot[]; now: Date }) {
  const [panel, setPanel] = useState<"time" | "cancel" | null>(null);
  const locked = isScheduleLocked(row.scheduledAt, now);
  return (
    <div className="-mx-4 border-b border-ink-200 py-4 pr-4 pl-3.5 shadow-[var(--p2-schedule-rail)]">
      <div className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3.5">
        <DeskThumb thumb={row.thumb} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="inline-block -rotate-4 rounded-[2px] border-[1.5px] border-ember-dark py-px pr-[calc(6px-0.2em)] pl-1.5 text-eyebrow font-bold tracking-[0.2em] text-ember-dark">
              排程
            </span>
            <span className="min-w-0 truncate text-eyebrow tracking-[0.1em] text-ink-600">{row.eyebrow}</span>
          </span>
          <Link href={row.href} className="font-serif-tc text-prose leading-[1.5] font-bold text-ink-950 no-underline">
            {row.title}
          </Link>
          <span className="text-note text-ink-600 tabular-nums">
            <b className="text-ember-dark">{scheduleWhenLabel(row.scheduledAt)}</b> 發佈・{row.platforms}
          </span>
          <span className="text-eyebrow text-ink-600 tabular-nums">
            {locked ? "快要發出去了，不能再改" : timeLeftLabel(row.scheduledAt, now)}
          </span>
          <DeskSocialLink href={row.socialHref} title={row.title} />
          {locked ? null : (
            <div className="mt-0.5 flex gap-[22px]">
              <button
                type="button"
                aria-expanded={panel === "time"}
                onClick={() => setPanel(panel === "time" ? null : "time")}
                className="min-h-11 text-note font-bold text-ink-950"
              >
                <span className={`pb-[3px] ${panel === "time" ? UNDERLINE_ON : "shadow-[var(--p2-underline-off)]"}`}>改時間</span>
              </button>
              <button
                type="button"
                aria-expanded={panel === "cancel"}
                onClick={() => setPanel(panel === "cancel" ? null : "cancel")}
                className="min-h-11 text-note text-ink-700"
              >
                取消排程
              </button>
            </div>
          )}
        </div>
      </div>
      {panel === "time" ? <TimePanel row={row} slots={slots} onDone={() => setPanel(null)} /> : null}
      {panel === "cancel" ? <CancelPanel row={row} onKeep={() => setPanel(null)} /> : null}
    </div>
  );
}

export function ScheduledList({ rows, slots, nowIso }: { rows: ScheduledRow[]; slots: ScheduleSlot[]; nowIso: string }) {
  const now = new Date(nowIso);
  return (
    <div>
      {rows.length === 0 ? (
        <p className="mt-6 mb-0 font-serif-tc text-prose leading-[1.8] text-ink-700">沒有排程中的文章。</p>
      ) : (
        rows.map((row) => <ScheduledItem key={row.id} row={row} slots={slots} now={now} />)
      )}
      <p className="mt-[18px] mb-0 border-t border-ink-200 pt-3 text-caption leading-[1.8] text-ink-600">
        排程的貼文，到時間會發到勾選的平台；在那之前都還能改。
      </p>
    </div>
  );
}
