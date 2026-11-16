import { NextResponse } from "next/server";
import { notFoundResponse, requireApiUser } from "@/lib/auth/api";
import { communityEnabled } from "@/lib/features";
import { readJson, serverError } from "@/lib/http";
import { decideSend, isLetterOpen } from "@/lib/letters/policy";
import { findEpisodeBySlug, findSentLetter, insertLetter, isBlockedBy } from "@/lib/letters/repository";
import { validateLetterText } from "@/lib/letters/rules";
import { getProfilePenName } from "@/lib/me/pen-name";
import { limitLetterSend } from "@/lib/rate-limit/letters";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * POST { slug, body } → 201 { success, data: { sentAt } }
 * 寫信給作者：需登入、要有筆名、每人每篇一封、≤140 字。
 * 被作者封鎖時一樣回 201（信標記 suppressed，作者看不到），不讓寄信人知道被封鎖。
 */
export async function POST(request: Request) {
  if (!communityEnabled()) return notFoundResponse();
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const payload = await readJson(request);
  const { slug, body } = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  if (typeof slug !== "string") return fail(400, "找不到這篇文章");
  const text = validateLetterText(body);
  if (!text.ok) return fail(400, text.error);

  const limited = limitLetterSend(auth.userId);
  if (limited) return limited;

  try {
    const db = createAdminClient();
    const episode = await findEpisodeBySlug(db, slug);
    // 不開放回信的文章（含舊資料作者 'default'）不再往下查，decideSend 直接回 404
    const [penName, sent, blocked] = episode && isLetterOpen(episode)
      ? await Promise.all([
          getProfilePenName(auth.userId),
          findSentLetter(db, episode.id, auth.userId),
          isBlockedBy(db, episode.user_id, auth.userId),
        ])
      : [null, null, false];

    const outcome = decideSend({
      episode,
      senderId: auth.userId,
      senderPenName: penName,
      alreadySent: Boolean(sent),
      blocked,
    });
    if (outcome.kind === "reject") return fail(outcome.status, outcome.error);
    if (!episode) return fail(404, "這篇文章沒有開放寫信");

    const inserted = await insertLetter(db, {
      episodeId: episode.id,
      senderId: auth.userId,
      authorId: episode.user_id,
      body: text.value,
      suppressed: outcome.kind === "suppress",
    });
    if (!inserted.ok) return fail(409, "這篇已經寄過一封信了");
    return NextResponse.json({ success: true, data: { sentAt: inserted.createdAt } }, { status: 201 });
  } catch (error) {
    return serverError("letters:send", error, "信沒有寄出，等一下再試");
  }
}
