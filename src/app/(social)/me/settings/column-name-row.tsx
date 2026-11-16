"use client";

import { useState, useTransition } from "react";
import { COLUMN_NAME_MAX_LENGTH, normalizeColumnName } from "@/lib/me/column-name";
import { saveColumnNameAction } from "./column-name-actions";

/**
 * 專欄名（設計稿「P2 設定 A」署名區第三列）：右側顯示目前的專欄名，點「改」就地編輯。
 * 存檔走 server action（以 session 的 userId 寫入）；清空＝不取，索引與專欄頁就不顯示那一行。
 */
export function ColumnNameRow({ initial }: { initial: string | null }) {
  const [saved, setSaved] = useState<string | null>(initial);
  const [draft, setDraft] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const length = Array.from(normalizeColumnName(draft)).length;
  const over = length > COLUMN_NAME_MAX_LENGTH;

  const open = () => {
    setDraft(saved ?? "");
    setError(null);
    setEditing(true);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (over || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await saveColumnNameAction(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(result.columnName);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-ink-200 text-lede text-ink-950">
        <span id="column-name">專欄名</span>
        <span className="flex min-w-0 items-center gap-3 text-note">
          <span data-testid="column-name-value" className={`truncate ${saved ? "font-serif-tc text-ink-800" : "text-ink-400"}`}>
            {saved ?? "還沒取"}
          </span>
          <button type="button" onClick={open} aria-describedby="column-name" className="min-h-11 flex-none font-bold text-ember-dark">
            {saved ? "改" : "取一個"}
          </button>
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="border-b border-ink-200 pt-3.5 pb-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor="column-name-input" className="text-lede text-ink-950">
          專欄名
        </label>
        <span className={`text-eyebrow tabular-nums ${over ? "text-ember-deep" : "text-ink-600"}`}>
          {length}/{COLUMN_NAME_MAX_LENGTH}
        </span>
      </div>
      <input
        id="column-name-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        autoFocus
        autoComplete="off"
        enterKeyHint="done"
        placeholder="例如：公車上的散場"
        aria-invalid={over || Boolean(error)}
        className="mt-2 h-11 w-full min-w-0 border-0 border-b border-ink-950 bg-transparent p-0 font-serif-tc text-prose font-bold text-ink-950 caret-ember outline-none placeholder:font-normal placeholder:text-ink-300"
      />
      <p className="mt-1.5 mb-0 text-caption leading-[1.7] text-ink-700">
        會印在你的專欄頁與索引的作者列，筆名旁邊。留空就不顯示。
      </p>
      {error ? (
        <p role="alert" className="mt-1 mb-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-1 flex gap-5">
        <button type="submit" disabled={over || pending} className="min-h-11 text-note font-bold text-ember-dark disabled:text-ink-400">
          {pending ? "存檔中…" : "存檔"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className="min-h-11 text-note text-ink-600">
          取消
        </button>
      </div>
    </form>
  );
}
