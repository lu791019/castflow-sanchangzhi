"use client";

/** 「你知道？告訴我們」：缺連結時的小表單（Q-30）。要登入，未登入走 loginRedirectPath 回原頁 */

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { loginRedirectPath } from "@/lib/auth/paths";
import { LINK_KIND_LABELS } from "@/lib/links/merge";
import type { LinkKind, WorkLink } from "@/lib/links/types";

/** 觸控目標補到 44px（UX-19）：外觀 36px，用 ::before 上下各撐 4px */
const HIT_Y4 = "relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']";

/** 按鈕、輸入框提示、底部說明；沒給用預設（在哪看／買票／官網） */
export interface TellUsCopy {
  button: string;
  placeholder: string;
  footnote: string;
}

const DEFAULT_COPY: TellUsCopy = {
  button: "你知道？告訴我們",
  placeholder: "貼上網址，例：https://kktix.com/…",
  footnote: "常見平台與售票站的網址會直接出現；其他網址確認過後才放上來。",
};

interface TellUsProps {
  workId: string;
  kinds: LinkKind[];
  copy?: TellUsCopy;
  /** 送出、已生效的連結交給呼叫端直接放進畫面（LiveWorkLinks、記一筆）；沒給就 router.refresh() 讓 server 頁重讀 */
  onAdded?: (link: WorkLink) => void;
}

type Phase = "closed" | "open" | "sending" | "pending";

export function TellUs({ workId, kinds, copy = DEFAULT_COPY, onAdded }: TellUsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("closed");
  const [kind, setKind] = useState<LinkKind>(kinds[0] ?? "watch");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (kinds.length === 0) return null;
  if (phase === "pending") {
    return <p className="m-0 py-2 text-caption text-ink-700">收到了，確認過後就會出現。</p>;
  }
  if (phase === "closed") {
    return (
      <button type="button" onClick={() => setPhase("open")} className="flex min-h-11 items-center text-note font-bold text-ember-dark">
        {copy.button}
      </button>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim() || phase === "sending") return;
    setPhase("sending");
    setError(null);
    const response = await fetch(`/api/works/${workId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, url: url.trim() }),
    }).catch(() => null);
    if (response?.status === 401) {
      router.push(loginRedirectPath(pathname, window.location.search));
      return;
    }
    const body = (await response?.json().catch(() => null)) as
      | { data?: { status: "active" | "pending"; link: WorkLink }; error?: string }
      | null;
    if (!response?.ok || !body?.data) {
      setError(body?.error ?? "沒送成功，再按一次。");
      setPhase("open");
      return;
    }
    if (body.data.status === "pending") {
      setPhase("pending");
      return;
    }
    setPhase("closed");
    setUrl("");
    if (onAdded) onAdded(body.data.link);
    else router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-1 flex flex-col gap-2 border-b border-ink-200 pb-3">
      {kinds.length > 1 ? (
        <div role="radiogroup" aria-label="補哪一種" className="flex gap-2">
          {kinds.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === kind}
              onClick={() => setKind(option)}
              className={`${HIT_Y4} min-h-9 rounded-control border px-3 text-caption ${
                option === kind ? "border-place-selected-border bg-place-selected-bg font-bold text-ember-deep" : "border-ink-200 text-ink-800"
              }`}
            >
              {LINK_KIND_LABELS[option]}
            </button>
          ))}
        </div>
      ) : null}
      <label className="flex min-h-11 items-center gap-3 border-b border-ink-950">
        <span className="sr-only">網址</span>
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          maxLength={2000}
          placeholder={copy.placeholder}
          className="h-11 min-w-0 flex-1 bg-transparent text-lede text-ink-950 outline-none placeholder:text-ink-400"
        />
      </label>
      {error ? (
        <p role="alert" className="m-0 text-caption text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          aria-disabled={!url.trim() || phase === "sending"}
          className={`${HIT_Y4} inline-flex min-h-9 items-center rounded-control border border-ink-950 px-3.5 text-note font-bold text-ink-950`}
        >
          {phase === "sending" ? "送出中…" : "送出"}
        </button>
        <button type="button" onClick={() => setPhase("closed")} className="min-h-11 min-w-11 text-caption text-ink-700">
          算了
        </button>
      </div>
      <p className="m-0 text-eyebrow leading-relaxed text-ink-600">{copy.footnote}</p>
    </form>
  );
}
