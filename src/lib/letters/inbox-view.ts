/** 來信頁的資料組裝（server only）：信＋寄信人筆名＋寄往的文章標題 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LetterStatus } from "./format";
import { listInbox, loadLetterArticles, type InboxLetter, type LetterArticle } from "./inbox";
import { loadSenderPenNames } from "./repository";

export interface InboxEntry {
  letter: InboxLetter;
  senderName: string;
  article: LetterArticle;
}

const UNTITLED: LetterArticle = { title: "一篇文章", slug: null };

export async function loadInboxEntries(db: SupabaseClient, authorId: string): Promise<InboxEntry[]> {
  const letters = await listInbox(db, authorId);
  const [names, articles] = await Promise.all([
    loadSenderPenNames(
      db,
      letters.map((letter) => letter.sender_id),
    ),
    loadLetterArticles(
      db,
      letters.map((letter) => letter.episode_id),
    ),
  ]);
  // 寄信時一定有筆名；讀不到（帳號已刪）就不顯示這封
  return letters.flatMap((letter) => {
    const senderName = names.get(letter.sender_id);
    return senderName ? [{ letter, senderName, article: articles.get(letter.episode_id) ?? UNTITLED }] : [];
  });
}

export function toInboxRow({ letter, senderName, article }: InboxEntry) {
  return {
    id: letter.id,
    senderName,
    articleTitle: article.title,
    body: letter.body,
    status: letter.status as LetterStatus,
    hasReply: Boolean(letter.reply),
    unread: !letter.read_at,
    createdAt: letter.created_at,
  };
}
