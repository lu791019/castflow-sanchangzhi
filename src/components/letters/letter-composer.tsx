"use client";

/**
 * 寫封信給作者（文章頁 D 寫信中、E 寄出後）：稿紙格、署名、字數、寄出。
 * 寄出 → 信封出現、停 1.5s → 0.8s 淡出 → 收成一行「你在 10.10 寄了一封信」（motion.letterSent）。
 * 超過 140 字不擋輸入，只標示且不能寄出。
 */

import { useEffect, useRef, useState } from "react";
import { Seal } from "@/components/seal/seal";
import { countChars, LETTER_LIMIT, overLimitMessage } from "@/lib/letters/rules";
import { Envelope } from "./envelope";
import { LetterGrid } from "./letter-grid";
import { SentNote } from "./sent-note";

const HOLD_MS = 1500;
const FADE_MS = 800;

type Phase = "idle" | "sending" | "sent" | "fade" | "done";

interface LetterComposerProps {
  slug: string;
  authorName: string;
  senderName: string;
  /** 寄件人換過的印文（server 端取好） */
  senderGlyph?: string | null;
}

interface SendResponse {
  success?: boolean;
  error?: string;
  data?: { sentAt: string };
}

export function LetterComposer({ slug, authorName, senderName, senderGlyph }: LetterComposerProps) {
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const chars = countChars(draft);
  const over = chars > LETTER_LIMIT;
  const blank = draft.trim().length === 0;
  const disabled = blank || over || phase !== "idle";

  async function send() {
    if (disabled) return;
    setPhase("sending");
    setError(null);
    try {
      const response = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, body: draft }),
      });
      const json = (await response.json().catch(() => ({}))) as SendResponse;
      if (!response.ok || !json.data) {
        setError(json.error ?? "信沒有寄出，等一下再試");
        setPhase("idle");
        return;
      }
      setSentAt(json.data.sentAt);
      setPhase("sent");
      timers.current = [
        window.setTimeout(() => setPhase("fade"), HOLD_MS),
        window.setTimeout(() => {
          setPhase("done");
          setDraft("");
        }, HOLD_MS + FADE_MS),
      ];
    } catch {
      setError("網路好像斷了，信還在這裡，等一下再寄");
      setPhase("idle");
    }
  }

  if (phase === "done" && sentAt) return <SentNote sentAt={sentAt} authorName={authorName} />;

  if (phase === "sent" || phase === "fade") {
    return (
      <div
        role="status"
        className={`mt-3.5 flex h-[181px] flex-col items-center justify-center gap-[18px] transition-opacity duration-[800ms] motion-reduce:transition-none ${
          phase === "fade" ? "opacity-0" : "opacity-100"
        }`}
      >
        <Envelope senderName={senderName} senderGlyph={senderGlyph} />
        <p className="m-0 text-center font-serif-tc text-lede leading-[1.7] text-ink-950">
          寄出了。作者看到會決定要不要刊登。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-3.5 flex w-[331px] flex-col">
      <LetterGrid
        id="letter-to-author"
        label={`寫給作者的信，${LETTER_LIMIT} 字以內`}
        value={draft}
        onChange={setDraft}
        disabled={phase === "sending"}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-caption text-ink-700">
          署名
          <Seal penName={senderName} glyph={senderGlyph} size={24} />
          {senderName}
        </span>
        <span className="flex items-center gap-2.5">
          <span
            aria-live="polite"
            className={`text-caption tabular-nums underline-offset-[3px] ${
              over ? "font-bold text-ember-deep underline" : "text-ink-700"
            }`}
          >
            {chars}/{LETTER_LIMIT}
          </span>
          <button
            type="button"
            onClick={send}
            aria-disabled={disabled}
            className={`min-h-11 border-0 bg-transparent pr-0.5 pl-2 text-note font-bold tracking-[0.12em] ${
              disabled ? "cursor-default text-ink-400" : "cursor-pointer text-ember-dark"
            }`}
          >
            {phase === "sending" ? "寄出中" : "寄出"}
          </button>
        </span>
      </div>
      {over ? <p className="m-0 text-right text-caption text-ember-deep">{overLimitMessage(chars)}</p> : null}
      {error ? (
        <p role="alert" className="m-0 text-right text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
