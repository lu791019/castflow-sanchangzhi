import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { currentMonth, parseMonth } from "@/lib/journal/calendar";
import { createJournalEntry, findRecentRepeat, listJournalMonth } from "@/lib/journal/repository";
import { repeatSince, wantsRepeatCheck } from "@/lib/journal/repeat";
import { parseCreateJournalInput } from "@/lib/journal/validate";
import { badRequest, readJson, serverError } from "@/lib/http";
import { resolveLiveJournal } from "@/lib/venue/journal";

export const dynamic = "force-dynamic";

/** 月曆：GET /api/journal?month=2026-10 → { month, entries, days（每日彙總）, totals } */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const monthParam = request.nextUrl.searchParams.get("month") ?? currentMonth();
  const range = parseMonth(monthParam);
  if (!range) return badRequest("month 格式須為 YYYY-MM");

  try {
    return NextResponse.json(await listJournalMonth(auth.userId, range));
  } catch (error) {
    return serverError("journal:list", error, "讀取日誌失敗");
  }
}

/**
 * 記一筆：{ workId?, workTitle?, experiencedAt, venue, companions? }；remind_at 依提醒設定自動算。
 * 場外變體另帶 { liveName, liveVenue?, liveDates?, liveVenueType?, liveTicketUrl? }，由 server 建立或重用場刊作品（回應附 programmeSlug）。
 * 帶 checkRepeat: true（記一筆 sheet）且同一部作品 2 小時內記過 → 409 { repeat: { loggedAt } }，確認後不帶再送（UX-26）。
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const parsed = parseCreateJournalInput(body);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const live = await resolveLiveJournal(body, parsed.value, auth.userId);
    if (!live.ok) return badRequest(live.error);
    const workId = live.input.workId;
    if (workId && wantsRepeatCheck(body)) {
      const loggedAt = await findRecentRepeat(auth.userId, workId, repeatSince(new Date()), live.input.status === "planned");
      if (loggedAt) {
        return NextResponse.json({ error: "這部兩小時內記過了", repeat: { loggedAt: loggedAt.toISOString() } }, { status: 409 });
      }
    }
    await live.saveExtras();
    const entry = await createJournalEntry(auth.userId, live.input);
    return NextResponse.json({ entry, programmeSlug: live.programmeSlug }, { status: 201 });
  } catch (error) {
    return serverError("journal:create", error, "建立日誌紀錄失敗");
  }
}
