/** 文章末尾「讀者來函」：作者刊登的信（印章 40＋筆名＋明體內文＋日期；作者回覆縮排、印章 24、ink-600） */

import Link from "next/link";
import { PenSeal } from "@/components/seal/pen-seal";
import { authorPath } from "@/lib/authors/path";
import { letterDay, publishedCountLabel } from "@/lib/letters/format";

export interface PublishedLetterView {
  id: string;
  senderName: string;
  body: string;
  reply: string | null;
  createdAt: string;
}

export function PublishedLetters({ letters, authorName }: { letters: PublishedLetterView[]; authorName: string }) {
  return (
    <section id="letters" aria-label="讀者來函" className="mt-12 scroll-mt-4 border-t-2 border-ink-950">
      <div className="flex items-baseline justify-between pt-3">
        <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">讀者來函</span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">{publishedCountLabel(letters.length)}</span>
      </div>
      <p className="mt-1.5 mb-0 text-caption leading-[1.7] text-ink-600">讀者寫給作者的信，由作者選出刊登。</p>
      {letters.map((letter) => (
        <article
          key={letter.id}
          className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 border-b border-ink-200 py-5"
        >
          <Link
            href={authorPath(letter.senderName)}
            aria-label={`讀${letter.senderName}的專欄`}
            className="-m-0.5 flex size-11 items-center justify-center"
          >
            <PenSeal penName={letter.senderName} size={40} />
          </Link>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline justify-between">
              <span className="text-note font-bold text-ink-950">{letter.senderName}</span>
              <span className="text-caption text-ink-600 tabular-nums">{letterDay(letter.createdAt)}</span>
            </div>
            <p className="mt-1.5 mb-0 font-serif-tc text-lede leading-[1.85] tracking-[0.02em] whitespace-pre-line text-ink-800">
              {letter.body}
            </p>
            {letter.reply ? (
              <div className="mt-3.5 grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 border-l border-ink-200 pl-3">
                <PenSeal penName={authorName} size={24} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-caption leading-6 text-ink-600">作者回覆</span>
                  <p className="mt-0.5 mb-0 font-serif-tc text-lede leading-[1.8] tracking-[0.02em] whitespace-pre-line text-ink-600">
                    {letter.reply}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
