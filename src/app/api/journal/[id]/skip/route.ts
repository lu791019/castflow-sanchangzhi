import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { JournalNotFoundError, skipJournalEntry } from "@/lib/journal/repository";
import { UUID_PATTERN } from "@/lib/journal/types";
import { badRequest, serverError } from "@/lib/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** 只記不說：status → skipped，之後不再提醒 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return badRequest("id 格式錯誤");

  try {
    const entry = await skipJournalEntry(auth.userId, id);
    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof JournalNotFoundError) {
      return NextResponse.json({ error: "找不到這筆紀錄" }, { status: 404 });
    }
    return serverError("journal:skip", error, "更新紀錄失敗");
  }
}
