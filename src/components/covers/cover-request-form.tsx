"use client";

/**
 * 場刊「補封面」次鈕與小表單（Q-47）：點開同一個 CoverField（貼網址或上傳）→ POST /api/works/[id]/cover。
 * 通過 → 用 API 回的 posterUrl 直接換圖（cover-override），router.refresh() 只在背景同步；待審 → 「收到了，確認後會換上」。
 * 未登入按了 → loginRedirectPath 回原頁。
 */

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { loginRedirectPath } from "@/lib/auth/paths";
import { CoverField } from "./cover-field";
import { showApprovedPoster } from "./cover-override";

interface CoverRequestFormProps {
  workId: string;
  signedIn: boolean;
  pending: boolean;
  stamped: boolean;
}

type Phase = "closed" | "open" | "sending" | "pending" | "done";

export const COVER_PENDING_NOTE = "收到了，確認後會換上";

async function send(workId: string, url: string): Promise<{ status: number; body: { data?: { status: string; posterUrl?: string }; error?: string } | null }> {
  const response = await fetch(`/api/works/${workId}/cover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => null);
  if (!response) return { status: 0, body: null };
  return { status: response.status, body: await response.json().catch(() => null) };
}

export function CoverRequestForm({ workId, signedIn, pending, stamped }: CoverRequestFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>(pending ? "pending" : "closed");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toLogin = () => router.push(loginRedirectPath(pathname, window.location.search));

  // 通過、已換圖：補封面鈕收起（server 重讀後這整塊本來就不再出現）
  if (phase === "done") return null;
  if (phase === "pending") {
    return (
      <p role="status" className="m-0 mt-4 text-caption text-ink-700">
        {COVER_PENDING_NOTE}
      </p>
    );
  }
  if (phase === "closed") {
    return (
      <button
        type="button"
        onClick={() => (signedIn ? setPhase("open") : toLogin())}
        className="hit-44 mt-4 inline-flex min-h-9 items-center rounded-control border border-ink-950 px-3.5 text-note font-bold text-ink-950"
      >
        補封面
      </button>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim() || phase === "sending") return;
    setPhase("sending");
    setError(null);
    const { status, body } = await send(workId, url.trim());
    if (status === 401) return toLogin();
    if (status < 200 || status >= 300 || !body?.data) {
      setError(body?.error ?? "沒送成功，再按一次。");
      setPhase("open");
      return;
    }
    if (body.data.status === "pending") {
      setPhase("pending");
      return;
    }
    if (body.data.posterUrl) {
      showApprovedPoster(workId, body.data.posterUrl);
      setPhase("done");
    } else {
      setPhase("closed");
    }
    startTransition(() => router.refresh());
  };

  return (
    <form onSubmit={submit} aria-label="補封面" className={`${stamped ? "mt-10" : "mt-4"} flex flex-col gap-2 border-t border-ink-950 pt-1 pb-1`}>
      <CoverField
        value={url}
        hidePreview={error !== null}
        onChange={(value) => {
          setUrl(value);
          setError(null);
        }}
      />
      {error ? (
        <p role="alert" className="m-0 text-caption text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          aria-disabled={!url.trim() || phase === "sending"}
          className="hit-44 inline-flex min-h-9 items-center rounded-control border border-ink-950 px-3.5 text-note font-bold text-ink-950"
        >
          {phase === "sending" ? "送出中…" : "送出"}
        </button>
        <button type="button" onClick={() => setPhase("closed")} className="hit-44 min-h-9 text-caption text-ink-700">
          算了
        </button>
      </div>
      <p className="m-0 text-eyebrow leading-relaxed text-ink-600">常見圖庫、售票站與美術館官網的圖會直接換上；其他網址和上傳的圖確認過後才換上。</p>
    </form>
  );
}
