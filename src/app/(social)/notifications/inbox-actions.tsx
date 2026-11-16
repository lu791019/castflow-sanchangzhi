"use client";

/** 收件匣列的動作：說說看（先標已讀再進說一段）、只記不說（標 skipped＋已讀） */

import { useRouter } from "next/navigation";
import { useState } from "react";

async function markRead(id: string): Promise<boolean> {
  const response = await fetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  }).catch(() => null);
  return Boolean(response?.ok);
}

interface InboxActionsProps {
  notificationId: string;
  journalId: string;
  sayHref: string;
}

export function InboxActions({ notificationId, journalId, sayHref }: InboxActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const say = async () => {
    setPending(true);
    // 標已讀失敗不擋路：照樣進說一段，紅點下次再清
    if (!(await markRead(notificationId))) console.error("[inbox] 標已讀失敗", notificationId);
    router.push(sayHref);
  };

  const skip = async () => {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/journal/${encodeURIComponent(journalId)}/skip`, { method: "POST" }).catch(() => null);
    if (!response?.ok) {
      setPending(false);
      setError("沒成功，再按一次");
      return;
    }
    await markRead(notificationId);
    router.refresh();
  };

  return (
    <div className="mt-1 flex items-center gap-3.5">
      <button
        type="button"
        onClick={say}
        disabled={pending}
        className="hit-44 flex min-h-9 items-center rounded-control bg-action-primary px-3.5 text-note font-bold text-paper disabled:opacity-60"
      >
        說說看
      </button>
      <button type="button" onClick={skip} disabled={pending} className="min-h-11 text-note text-ink-700 disabled:opacity-60">
        只記不說
      </button>
      {error ? (
        <span role="alert" className="text-caption text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
