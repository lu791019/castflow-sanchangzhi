"use client";

/**
 * 檢舉／封鎖（設計稿沒畫，CPO 安全配套）：雜誌語彙的小字文字鈕，按了先在原地確認。
 * 封鎖後，這位寄信人之後寄給你任何文章的信都不會出現；對方不會知道。
 */

import { useState } from "react";
import type { LetterActionBody } from "./use-letter-action";

type Confirming = "report" | "block" | null;

interface LetterSafetyProps {
  senderName: string;
  reported: boolean;
  blocked: boolean;
  run: (body: LetterActionBody) => Promise<boolean>;
  pending: boolean;
}

const SMALL_BUTTON = "min-h-11 cursor-pointer border-0 bg-transparent p-0 text-caption disabled:cursor-default";

export function LetterSafety({ senderName, reported, blocked, run, pending }: LetterSafetyProps) {
  const [confirming, setConfirming] = useState<Confirming>(null);

  async function confirm() {
    if (!confirming) return;
    if (await run({ action: confirming })) setConfirming(null);
  }

  if (confirming) {
    const message =
      confirming === "report"
        ? "檢舉後，這封信不會再刊登，我們會看一下內容。"
        : `封鎖後，${senderName}之後寄來的信都不會出現在這裡，已刊登的會撤下。對方不會知道。`;
    return (
      <div role="group" aria-label={confirming === "report" ? "確認檢舉" : "確認封鎖"} className="mt-8 border-t border-ink-200 pt-2">
        <p className="m-0 text-caption leading-[1.7] text-ink-700">{message}</p>
        <div className="flex items-center gap-5">
          <button type="button" disabled={pending} onClick={confirm} className={`${SMALL_BUTTON} font-bold text-ember-deep`}>
            {confirming === "report" ? "確定檢舉" : "確定封鎖"}
          </button>
          <button type="button" onClick={() => setConfirming(null)} className={`${SMALL_BUTTON} text-ink-600`}>
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 flex items-center gap-5 border-t border-ink-200">
      {reported ? (
        <span className="flex min-h-11 items-center text-caption text-ink-600">已檢舉這封信</span>
      ) : (
        <button type="button" onClick={() => setConfirming("report")} className={`${SMALL_BUTTON} text-ink-600`}>
          檢舉這封信
        </button>
      )}
      {blocked ? (
        <span className="flex items-center gap-3 text-caption text-ink-600">
          已封鎖{senderName}
          <button type="button" disabled={pending} onClick={() => run({ action: "unblock" })} className={`${SMALL_BUTTON} text-ember-dark`}>
            解除封鎖
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming("block")} className={`${SMALL_BUTTON} text-ink-600`}>
          封鎖這位寄信人
        </button>
      )}
    </div>
  );
}
