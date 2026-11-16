/** 我的 › 來信的刊頭（P3 來信 A/D）：刊名、自己的印章與筆名、日誌／專欄／來信分頁（來信頁不推播，未讀只在這裡亮點） */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { lettersTabLabel } from "@/lib/letters/format";
import { columnLabel } from "@/lib/me/column-name";

const TAB = "flex min-h-11 items-center font-serif-tc text-prose no-underline";

export function MeLettersHeader({ penName, columnName, unread }: { penName: string; columnName: string | null; unread: number }) {
  const label = columnLabel(columnName);
  return (
    <>
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950 lg:hidden">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">散場誌</span>
        <Link
          href="/notifications"
          aria-label="提醒收件匣"
          className="-mr-2.5 flex size-11 items-center justify-center text-ink-950"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 13l2.5-8h11L20 13v6H4z" />
            <path d="M4 13h5l1 2h4l1-2h5" />
          </svg>
        </Link>
      </header>

      <div className="mx-4 flex items-center gap-2.5 pt-3.5">
        <PenSeal penName={penName} size={40} />
        <span className="flex flex-col gap-px">
          <span className="font-serif-tc text-lede font-bold text-ink-950">{penName}</span>
          {label ? <span className="text-eyebrow text-ink-600">{label}</span> : null}
        </span>
      </div>

      <nav aria-label="我的" className="mx-4 mt-2.5 flex gap-[26px] border-b border-ink-200">
        <Link href="/journal" className={`${TAB} text-ink-600`}>
          日誌
        </Link>
        <Link href="/me" className={`${TAB} text-ink-600`}>
          專欄
        </Link>
        <Link
          href="/me/letters"
          aria-current="page"
          aria-label={lettersTabLabel(unread)}
          className={`${TAB} relative font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]`}
        >
          來信
          {unread > 0 ? (
            <span aria-hidden="true" className="absolute top-[11px] -right-2.5 block size-1.5 rounded-full bg-ember" />
          ) : null}
        </Link>
      </nav>
    </>
  );
}
