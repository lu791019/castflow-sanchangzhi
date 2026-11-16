"use client";

/** 收聽提醒（Spotify 聽完一張專輯，Q-64 C1）：記一筆（先標已讀再去記一筆並預選專輯）、不用了（標已讀，直接換畫面不靠 refresh） */

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

export function ListenActions({ notificationId, logHref }: { notificationId: string; logHref: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = async () => {
    setPending(true);
    // 標已讀失敗不擋路：照樣去記一筆，紅點下次再清
    if (!(await markRead(notificationId))) console.error("[inbox] 標已讀失敗", notificationId);
    router.push(logHref);
  };

  const dismiss = async () => {
    setPending(true);
    setError(null);
    if (!(await markRead(notificationId))) {
      setPending(false);
      setError("沒成功，再按一次");
      return;
    }
    setDismissed(true);
  };

  if (dismissed) return <span className="mt-1 text-caption text-ink-600">好，這張先不記。</span>;
  return (
    <div className="mt-1 flex items-center gap-3.5">
      <button
        type="button"
        onClick={log}
        disabled={pending}
        className="hit-44 flex min-h-9 items-center rounded-control bg-action-primary px-3.5 text-note font-bold text-paper disabled:opacity-60"
      >
        記一筆
      </button>
      <button type="button" onClick={dismiss} disabled={pending} className="min-h-11 text-note text-ink-700 disabled:opacity-60">
        不用了
      </button>
      {error ? (
        <span role="alert" className="text-caption text-ember-deep">
          {error}
        </span>
      ) : null}
    </div>
  );
}
