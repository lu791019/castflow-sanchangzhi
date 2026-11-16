"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import type { ReminderTiming } from "@/lib/journal/types";
import { REMINDER_OPTIONS, reminderExample } from "@/lib/me/settings";

function CrossIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** 提醒時間 sheet（sheet.short：貼底、高度隨內容）；按「好」才存 */
export function ReminderSheet({
  initial,
  saving,
  error,
  onClose,
  onSave,
}: {
  initial: ReminderTiming;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (timing: ReminderTiming) => void;
}) {
  const [choice, setChoice] = useState<ReminderTiming>(initial);
  const example = reminderExample(choice, new Date());

  return (
    <Dialog.Root open onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-scrim transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] flex-col rounded-t-[4px] bg-paper pb-4 text-ink-900 outline-none transition duration-200 data-ending-style:translate-y-10 data-starting-style:translate-y-10">
          <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-sm bg-ink-300" />
          <div className="flex items-start justify-between pt-2 pr-2 pl-4">
            <div className="flex flex-col gap-1.5 pt-1.5">
              <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">提醒時間</span>
              <Dialog.Title className="m-0 font-serif-tc text-section font-bold text-ink-950">什麼時候問你</Dialog.Title>
            </div>
            <Dialog.Close aria-label="關閉" className="flex size-11 items-center justify-center text-ink-700">
              <CrossIcon />
            </Dialog.Close>
          </div>
          <p className="mx-4 mt-1.5 mb-0 text-caption leading-[1.7] text-ink-700">記一筆之後，我們只會問一次「想不想說說」。</p>
          <div role="radiogroup" aria-label="提醒時間" className="mx-4 mt-3 border-t border-ink-950">
            {REMINDER_OPTIONS.map((option) => {
              const on = option.value === choice;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setChoice(option.value)}
                  className="grid min-h-16 w-full grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-2.5 border-b border-ink-200 py-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[5px] ml-[3px] block size-3 rounded-full transition-colors ${
                      on ? "bg-ember shadow-[0_0_0_3px_var(--color-paper),0_0_0_4px_var(--color-ember)]" : "shadow-[inset_0_0_0_1px_var(--color-ink-400)]"
                    }`}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className={`text-lede text-ink-950 ${on ? "font-bold" : ""}`}>{option.title}</span>
                    <span className="text-caption text-ink-700">{option.note}</span>
                  </span>
                  <span className="pt-[3px] text-eyebrow text-ink-600">{option.tag}</span>
                </button>
              );
            })}
          </div>
          <div aria-live="polite" className="mx-4 mt-3.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 bg-paper-2 p-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-eyebrow text-ink-600">{example.fromLabel}</span>
              <span className="text-note font-bold text-ink-950 tabular-nums">{example.fromTime}</span>
            </span>
            <span aria-hidden="true" className="relative block h-px bg-ink-400">
              <span className="absolute -top-[3px] -right-px block size-1.5 rotate-45 border-t border-r border-ink-400" />
            </span>
            <span className="flex flex-col gap-0.5 text-right">
              <span className="text-eyebrow text-ink-600">{example.toLabel}</span>
              <span className={`text-note font-bold tabular-nums ${example.muted ? "text-ink-700" : "text-ember-dark"}`}>{example.toTime}</span>
            </span>
          </div>
          {error ? (
            <p role="alert" className="mx-4 mt-2 mb-0 text-caption text-ember-deep">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(choice)}
            className="mx-4 mt-4 h-[52px] rounded-[4px] bg-ember-dark text-lede font-bold tracking-[0.16em] text-paper disabled:opacity-60"
          >
            {saving ? "存檔中…" : "好"}
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
