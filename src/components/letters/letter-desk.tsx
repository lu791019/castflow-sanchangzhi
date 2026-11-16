"use client";

/**
 * 單封展開的作者動作（P3 來信 B/C）：刊登在文章末尾／只放在這裡／撤下、回一句（每封一次、≤140 字）。
 * 安全配套（設計稿沒畫，CPO 要求）：檢舉這封信、封鎖這位寄信人——最小的文字鈕，放在最下方，按了先確認。
 */

import Link from "next/link";
import { useState } from "react";
import type { LetterStatus } from "@/lib/letters/format";
import { countChars, LETTER_LIMIT } from "@/lib/letters/rules";
import { LetterSafety } from "./letter-safety";
import { useLetterAction } from "./use-letter-action";

interface LetterDeskProps {
  letterId: string;
  status: LetterStatus;
  senderName: string;
  articleHref: string | null;
  publishedDay: string | null;
  hasReply: boolean;
  reported: boolean;
  blocked: boolean;
}

const TEXT_BUTTON = "min-h-11 cursor-pointer border-0 bg-transparent p-0 text-note tracking-[0.06em] disabled:cursor-default";
const RULE = "mx-4 block h-3.5 w-px bg-ink-200";

function StatusBlock({ status, senderName, articleHref, publishedDay, reported, run, pending }: {
  status: LetterStatus;
  senderName: string;
  articleHref: string | null;
  publishedDay: string | null;
  reported: boolean;
  run: ReturnType<typeof useLetterAction>["run"];
  pending: boolean;
}) {
  if (status === "published") {
    return (
      <>
        <div className="flex items-center">
          <span className="flex-1 text-note font-bold text-ember-deep">已刊登在文章末尾</span>
          {articleHref ? (
            <Link href={`${articleHref}#letters`} className="flex min-h-11 items-center text-note font-bold text-ember-dark no-underline">
              去看看 →
            </Link>
          ) : null}
          <span aria-hidden="true" className={RULE} />
          <button type="button" disabled={pending} onClick={() => run({ action: "unpublish" })} className={`${TEXT_BUTTON} text-ink-700`}>
            撤下
          </button>
        </div>
        <p className="m-0 text-caption leading-[1.7] text-ink-600">
          刊登於 {publishedDay ?? "—"}。撤下後，信會回到這裡，不會消失。
        </p>
      </>
    );
  }
  if (status === "kept") {
    return (
      <>
        <div className="flex items-center">
          <span className="flex-1 text-note font-bold text-ink-950">只放在這裡</span>
          {reported ? null : (
            <button type="button" disabled={pending} onClick={() => run({ action: "publish" })} className={`${TEXT_BUTTON} font-bold text-ember-dark`}>
              改為刊登
            </button>
          )}
        </div>
        <p className="m-0 text-caption leading-[1.7] text-ink-600">這封信只有你看得到。寄信的人不會收到任何通知。</p>
      </>
    );
  }
  return (
    <>
      <div className="flex items-center">
        {reported ? null : (
          <>
            <button type="button" disabled={pending} onClick={() => run({ action: "publish" })} className={`${TEXT_BUTTON} font-bold text-ember-dark`}>
              刊登在文章末尾
            </button>
            <span aria-hidden="true" className={RULE} />
          </>
        )}
        <button type="button" disabled={pending} onClick={() => run({ action: "keep" })} className={`${TEXT_BUTTON} text-ink-700`}>
          只放在這裡
        </button>
      </div>
      <p className="m-0 text-caption leading-[1.7] text-ink-600">
        刊登後，這封信會署名「{senderName}」，出現在文章末尾的讀者來函。之後也可以撤下。
      </p>
    </>
  );
}

function ReplyBox({ senderName, run, pending }: {
  senderName: string;
  run: ReturnType<typeof useLetterAction>["run"];
  pending: boolean;
}) {
  const [reply, setReply] = useState("");
  const chars = countChars(reply);
  const over = chars > LETTER_LIMIT;
  const disabled = reply.trim().length === 0 || over || pending;

  async function send() {
    if (disabled) return;
    if (await run({ action: "reply", reply })) setReply("");
  }

  return (
    <div className="mt-5">
      <label htmlFor="letter-reply" className="text-caption font-bold tracking-[0.12em] text-ink-950">
        回一句
      </label>
      <div className="mt-0.5 flex min-h-11 items-center gap-2.5 border-b border-ink-950">
        <input
          id="letter-reply"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) void send();
          }}
          placeholder={`回一句話給${senderName}…`}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 font-serif-tc text-lede text-ink-950 outline-none placeholder:text-ink-600"
        />
        <span className={`text-eyebrow tabular-nums ${over ? "text-ember-deep underline" : "text-ink-600"}`}>
          {chars}/{LETTER_LIMIT}
        </span>
        <button
          type="button"
          onClick={send}
          aria-disabled={disabled}
          className={`-mr-1 min-h-11 border-0 bg-transparent px-1 text-note font-bold tracking-[0.1em] ${
            disabled ? "cursor-default text-ink-400" : "cursor-pointer text-ember-dark"
          }`}
        >
          送出
        </button>
      </div>
      <p className="mt-1.5 mb-0 text-eyebrow leading-[1.6] text-ink-600">回覆會附在這封信下方；刊登時，一起出現在文章末尾。</p>
    </div>
  );
}

export function LetterDesk(props: LetterDeskProps) {
  const { run, pending, error } = useLetterAction(props.letterId);
  return (
    <>
      <div className="mt-[22px] border-t border-ink-200">
        <StatusBlock {...props} run={run} pending={pending} />
      </div>
      {props.hasReply ? null : <ReplyBox senderName={props.senderName} run={run} pending={pending} />}
      {error ? (
        <p role="alert" className="mt-2 mb-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
      <LetterSafety
        senderName={props.senderName}
        reported={props.reported}
        blocked={props.blocked}
        run={run}
        pending={pending}
      />
    </>
  );
}
