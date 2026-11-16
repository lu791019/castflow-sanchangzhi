import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { communityEnabled } from "@/lib/features";
import { PenSeal } from "@/components/seal/pen-seal";
import { LetterDesk } from "@/components/letters/letter-desk";
import { PublishedStamp } from "@/components/letters/published-stamp";
import { requirePageUserId } from "@/lib/auth/page";
import { authorPath } from "@/lib/authors/path";
import { letterDay, letterTime, stampDate } from "@/lib/letters/format";
import { markRead } from "@/lib/letters/inbox";
import { loadInboxEntries } from "@/lib/letters/inbox-view";
import { isBlockedBy } from "@/lib/letters/repository";
import { loadPenName } from "@/lib/me/pen-name";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "來信｜散場誌",
};

/** 來信・單封展開（P3 來信 B/C）：打開即已讀；別人的信、不存在的信一律 404 */
export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  if (!communityEnabled()) notFound();
  const { id } = await params;
  const userId = await requirePageUserId(`/me/letters/${id}`);
  const db = createAdminClient();
  const entries = await loadInboxEntries(db, userId);
  const index = entries.findIndex((entry) => entry.letter.id === id);
  if (index < 0) notFound();

  const { letter, senderName, article } = entries[index];
  const [penName, blocked] = await Promise.all([
    loadPenName(userId),
    isBlockedBy(db, userId, letter.sender_id),
    letter.read_at ? Promise.resolve() : markRead(db, userId, letter.id),
  ]);
  const articleHref = article.slug ? `/s/${article.slug}` : null;
  const published = letter.status === "published" && Boolean(letter.published_at);

  return (
    <div className="pb-[120px]">
      <header className="mx-4 grid h-[52px] grid-cols-[1fr_auto_1fr] items-center border-b border-ink-950">
        <Link
          href="/me/letters"
          aria-label="返回來信"
          className="-ml-3 flex size-11 items-center justify-center justify-self-start text-ink-950"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="m-0 font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">來信</h1>
        <span className="justify-self-end text-eyebrow tracking-[0.1em] text-ink-600 tabular-nums">
          {index + 1}／{entries.length}
        </span>
      </header>

      <article className="relative mx-4 pt-5">
        <div className="flex flex-col gap-1 pr-[100px]">
          <span className="text-eyebrow tracking-[0.12em] text-ink-600 tabular-nums">{letterTime(letter.created_at)}</span>
          {articleHref ? (
            <Link href={articleHref} className="font-serif-tc text-note leading-[1.65] text-ink-800 no-underline">
              致〈{article.title}〉<span className="text-ember-dark">›</span>
            </Link>
          ) : (
            <span className="font-serif-tc text-note leading-[1.65] text-ink-800">致〈{article.title}〉</span>
          )}
        </div>

        <PublishedStamp published={published} date={letter.published_at ? stampDate(letter.published_at) : ""} />

        <p className="mt-5 mb-0 font-serif-tc text-prose leading-[1.9] tracking-[0.03em] whitespace-pre-line text-ink-900">
          {letter.body}
        </p>
        <div className="mt-3.5 flex items-center justify-end gap-2.5">
          <span className="text-note text-ink-700">—— {senderName}</span>
          <Link
            href={authorPath(senderName)}
            aria-label={`讀${senderName}的專欄`}
            className="-m-0.5 flex size-11 items-center justify-center"
          >
            <PenSeal penName={senderName} size={40} />
          </Link>
        </div>

        {letter.reply ? (
          <div className="mt-4 grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 border-l border-ink-200 pl-3">
            <PenSeal penName={penName} size={24} />
            <div className="flex min-w-0 flex-col">
              <span className="text-caption leading-6 text-ink-600">你的回覆</span>
              <p className="mt-0.5 mb-0 font-serif-tc text-lede leading-[1.8] tracking-[0.02em] whitespace-pre-line text-ink-600">
                {letter.reply}
              </p>
            </div>
          </div>
        ) : null}

        <LetterDesk
          letterId={letter.id}
          status={letter.status}
          senderName={senderName}
          articleHref={articleHref}
          publishedDay={letter.published_at ? letterDay(letter.published_at) : null}
          hasReply={Boolean(letter.reply)}
          reported={Boolean(letter.reported_at)}
          blocked={blocked}
        />
      </article>
    </div>
  );
}
