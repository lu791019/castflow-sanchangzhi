import { NextResponse } from "next/server";
import { notFoundResponse, requireApiUser } from "@/lib/auth/api";
import { communityEnabled } from "@/lib/features";
import { getServerNotify } from "@/lib/alerts/notify";
import { readJson, serverError } from "@/lib/http";
import { blockSender, findInboxLetter, unblockSender, updateInboxLetter } from "@/lib/letters/inbox";
import { letterPatch, parseAuthorAction } from "@/lib/letters/policy";
import { limitLetterAction } from "@/lib/rate-limit/letters";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const NOT_FOUND = "找不到這封信";

/**
 * PATCH { action, reply? } → { success }
 * 作者處理一封來信：publish／keep／unpublish／reply（每封一次）／report／block／unblock。
 * 只認 author_id = 目前登入者；別人的信、被遮蔽的信一律 404。
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!communityEnabled()) return notFoundResponse();
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = parseAuthorAction(await readJson(request));
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

  const limited = limitLetterAction(auth.userId);
  if (limited) return limited;

  const { id } = await params;
  try {
    const db = createAdminClient();
    const letter = await findInboxLetter(db, auth.userId, id);
    if (!letter) return notFoundResponse(NOT_FOUND);

    const { action } = parsed;
    if (action.type === "block") {
      await blockSender(db, auth.userId, letter.sender_id);
      return NextResponse.json({ success: true });
    }
    if (action.type === "unblock") {
      await unblockSender(db, auth.userId, letter.sender_id);
      return NextResponse.json({ success: true });
    }

    const result = letterPatch(letter, action, new Date());
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    await updateInboxLetter(db, auth.userId, letter.id, result.patch);

    if (action.type === "report" && result.patch.reported_at) {
      // 檢舉要有人看：推警報，不只寫 log
      await getServerNotify()("warn", "來信被檢舉", `letter=${letter.id} episode=${letter.episode_id}`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("letters:update", error, "沒有處理成功，等一下再試");
  }
}
