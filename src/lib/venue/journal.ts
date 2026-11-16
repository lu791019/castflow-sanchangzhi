/** 記一筆 API 的場外接線（server only）：場外變體把手寫名稱換成場刊作品 id */

import type { CreateJournalInput } from "@/lib/journal/validate";
import { saveLiveCover } from "@/lib/covers/live-cover";
import { coversPublicPrefix } from "@/lib/covers/storage";
import { parseCoverUrl } from "@/lib/covers/upload";
import { parseLiveLinkExtras } from "@/lib/links/live-input";
import { saveLiveLinkExtras } from "@/lib/links/live-links";
import { parseLiveJournalInput } from "./input";
import { findOrCreateLiveWork } from "./repository";

export type LiveJournalResolution =
  | {
      ok: true;
      input: CreateJournalInput;
      programmeSlug: string | null;
      /** 場館類型、售票網址、封面：確定要記下（過了再記確認）才寫，免得 409 後再送一次重複待審 */
      saveExtras: () => Promise<void>;
    }
  | { ok: false; error: string };

const NOTHING_TO_SAVE = async (): Promise<void> => undefined;

/**
 * 不是場外變體 → 原樣通過；是 → 建立或重用場外作品並綁上 workId（名稱留作 fallback）。
 * 場外另可帶場館類型與售票網址（散場之前 A／C），寫進場刊的 works.venue_type 與 work_links(manual)；
 * 封面網址（貼的或上傳後的）走補封面共用流程：外部網址轉存、白名單才補空的 works.poster_url，其餘待審。
 */
export async function resolveLiveJournal(body: unknown, input: CreateJournalInput, userId: string): Promise<LiveJournalResolution> {
  const live = parseLiveJournalInput(body, input.experiencedAt);
  if (!live.ok) return live;
  if (!live.value) return { ok: true, input, programmeSlug: null, saveExtras: NOTHING_TO_SAVE };
  const extras = parseLiveLinkExtras(body as Record<string, unknown>, live.value.kind);
  if (!extras.ok) return extras;
  const cover = parseCoverUrl((body as Record<string, unknown>).liveCoverUrl, coversPublicPrefix());
  if (!cover.ok) return cover;
  const work = await findOrCreateLiveWork(live.value);
  const coverUrl = cover.value;
  return {
    ok: true,
    input: { ...input, workId: work.id, workTitle: live.value.name, venue: live.value.kind },
    programmeSlug: work.slug,
    saveExtras: async () => {
      await saveLiveLinkExtras(work.id, userId, extras.value);
      if (coverUrl) await saveLiveCover(work.id, userId, coverUrl);
    },
  };
}
