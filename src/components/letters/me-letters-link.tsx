/** 我的 › 「來信」入口：有未讀時亮燒橙點（不推播，只在這裡看到） */

import Link from "next/link";
import { countUnread } from "@/lib/letters/inbox";
import { lettersTabLabel } from "@/lib/letters/format";
import { createAdminClient } from "@/lib/supabase/admin";

export async function MeLettersLink({ userId }: { userId: string }) {
  const unread = await countUnread(createAdminClient(), userId).catch((error: unknown) => {
    console.error("[letters] 讀取未讀數失敗", error instanceof Error ? error.message : error);
    return 0;
  });
  return (
    <Link
      href="/me/letters"
      aria-label={lettersTabLabel(unread)}
      className="flex min-h-[52px] items-center justify-between border-b border-ink-200 text-note text-ink-700 no-underline"
    >
      <span className="relative">
        來信
        {unread > 0 ? (
          <span aria-hidden="true" className="absolute top-0.5 -right-2.5 block size-1.5 rounded-full bg-ember" />
        ) : null}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-600">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
