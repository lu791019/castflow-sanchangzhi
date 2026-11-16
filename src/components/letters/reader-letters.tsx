/**
 * 文章頁的讀者來函＋寫封信給作者（P3 文章頁 A/D/E）。只在 /s/[slug] 插入這一個元件。
 * 只有「以筆名署名＋公開發佈」的文章才出現（匿名、只給有連結的人、私人一律不出現、不露印章）。
 * 寫信要登入、要有筆名；作者看自己的文章不顯示寫信框；寄過的人只看到收成的一行。
 */

import Link from "next/link";
import { loadGlyphForPenName, PenSeal } from "@/components/seal/pen-seal";
import { loginRedirectPath, PEN_NAME_PATH } from "@/lib/auth/paths";
import { getCurrentUserId } from "@/lib/auth/session";
import { isLetterOpen } from "@/lib/letters/policy";
import {
  findEpisodeBySlug,
  findSentLetter,
  listPublishedLetters,
  loadSenderPenNames,
} from "@/lib/letters/repository";
import { getProfilePenName } from "@/lib/me/pen-name";
import { createAdminClient } from "@/lib/supabase/admin";
import { LetterComposer } from "./letter-composer";
import { PublishedLetters, type PublishedLetterView } from "./published-letters";
import { SentNote } from "./sent-note";

type Viewer =
  | { kind: "guest" }
  | { kind: "author" }
  | { kind: "no-pen-name" }
  | { kind: "sent"; sentAt: string }
  | { kind: "writer"; penName: string; glyph: string | null };

async function loadViewer(episodeId: string, authorId: string): Promise<Viewer> {
  const userId = await getCurrentUserId();
  if (!userId) return { kind: "guest" };
  if (userId === authorId) return { kind: "author" };
  const [penName, sent] = await Promise.all([
    getProfilePenName(userId),
    findSentLetter(createAdminClient(), episodeId, userId),
  ]);
  if (sent) return { kind: "sent", sentAt: sent.created_at };
  return penName ? { kind: "writer", penName, glyph: await loadGlyphForPenName(penName) } : { kind: "no-pen-name" };
}

function GuideLink({ href, text, action }: { href: string; text: string; action: string }) {
  return (
    <div className="mt-3.5 flex items-center justify-between gap-3 border-y border-ink-200 py-2">
      <span className="text-note leading-[1.75] text-ink-700">{text}</span>
      <Link href={href} className="flex min-h-11 flex-none items-center text-note font-bold text-ember-dark no-underline">
        {action}
      </Link>
    </div>
  );
}

function WriteBody({ viewer, slug, authorName }: { viewer: Viewer; slug: string; authorName: string }) {
  const here = `/s/${slug}`;
  switch (viewer.kind) {
    case "guest":
      return <GuideLink href={loginRedirectPath(here, "")} text="登入後，就能寫信給作者。" action="登入寫信 →" />;
    case "no-pen-name":
      return (
        <GuideLink
          href={`${PEN_NAME_PATH}?next=${encodeURIComponent(here)}`}
          text="信要署名。先取一個筆名。"
          action="取筆名 →"
        />
      );
    case "sent":
      return <SentNote sentAt={viewer.sentAt} authorName={authorName} />;
    case "writer":
      return <LetterComposer slug={slug} authorName={authorName} senderName={viewer.penName} senderGlyph={viewer.glyph} />;
    case "author":
      return null;
  }
}

interface SectionData {
  letters: PublishedLetterView[];
  viewer: Viewer;
}

async function loadSection(slug: string): Promise<SectionData | null> {
  const db = createAdminClient();
  const episode = await findEpisodeBySlug(db, slug);
  if (!episode || !isLetterOpen(episode)) return null;

  const [rows, viewer] = await Promise.all([
    listPublishedLetters(db, episode.id),
    loadViewer(episode.id, episode.user_id),
  ]);
  const names = await loadSenderPenNames(
    db,
    rows.map((row) => row.sender_id),
  );
  const letters = rows.flatMap((row) => {
    const senderName = names.get(row.sender_id);
    return senderName
      ? [{ id: row.id, senderName, body: row.body, reply: row.reply, createdAt: row.created_at }]
      : [];
  });
  return { letters, viewer };
}

export async function ReaderLetters({ slug, authorName }: { slug: string; authorName: string }) {
  // 回信區壞掉不該拖垮整篇文章：記錯誤、這一區不顯示
  const data = await loadSection(slug).catch((error: unknown) => {
    console.error("[letters] 文章頁回信區載入失敗", error instanceof Error ? error.message : error);
    return null;
  });
  if (!data) return null;
  const { letters, viewer } = data;

  return (
    <div className="flex flex-col">
      {letters.length > 0 ? <PublishedLetters letters={letters} authorName={authorName} /> : null}
      {viewer.kind === "author" ? null : (
        <section aria-labelledby="write-letter-heading" className={letters.length > 0 ? "mt-10" : "mt-12"}>
          <div className="flex items-center justify-between">
            <h2
              id="write-letter-heading"
              className="m-0 font-serif-tc text-prose font-bold tracking-[0.04em] text-ink-950"
            >
              寫封信給作者
            </h2>
            <span className="flex items-center gap-1.5 text-caption text-ink-700">
              致
              <PenSeal penName={authorName} size={24} />
              {authorName}
            </span>
          </div>
          <p className="mt-1.5 mb-0 text-caption leading-[1.7] text-ink-600">作者看得到，也可以選擇刊登在這裡。</p>
          <WriteBody viewer={viewer} slug={slug} authorName={authorName} />
        </section>
      )}
    </div>
  );
}
