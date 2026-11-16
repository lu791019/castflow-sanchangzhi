import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUserId } from "@/lib/auth/page";
import { loadInboxEntries, toInboxRow } from "@/lib/letters/inbox-view";
import { loadColumnName } from "@/lib/me/column-name-repository";
import { loadPenName } from "@/lib/me/pen-name";
import { createAdminClient } from "@/lib/supabase/admin";
import { communityEnabled } from "@/lib/features";
import { InboxEmpty, InboxList } from "@/components/letters/inbox-list";
import { MeLettersHeader } from "@/components/letters/me-letters-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "來信｜散場誌",
};

/** 我的 › 來信（P3 來信 A 列表／D 空）：只有自己看得到；不推播，未讀只在這裡亮點 */
export default async function LettersPage() {
  if (!communityEnabled()) notFound();
  const userId = await requirePageUserId("/me/letters");
  const [entries, penName, columnName] = await Promise.all([
    loadInboxEntries(createAdminClient(), userId),
    loadPenName(userId),
    loadColumnName(userId),
  ]);
  const rows = entries.map(toInboxRow);
  const unread = rows.filter((row) => row.unread).length;

  return (
    <div className="pb-[120px]">
      <MeLettersHeader penName={penName} columnName={columnName} unread={unread} />
      {rows.length > 0 ? <InboxList rows={rows} /> : <InboxEmpty />}
    </div>
  );
}
