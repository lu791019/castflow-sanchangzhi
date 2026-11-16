import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getReminderTiming, setReminderTiming } from "@/lib/journal/repository";
import { isReminderTiming, REMINDER_TIMINGS } from "@/lib/journal/types";
import { badRequest, readJson, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** 提醒時間設定：next_noon（預設）/ half_day / off */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ timing: await getReminderTiming(auth.userId) });
  } catch (error) {
    return serverError("journal:settings", error, "讀取提醒設定失敗");
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = (await readJson(request)) as { timing?: unknown } | null;
  if (!isReminderTiming(body?.timing)) {
    return badRequest(`timing 須為 ${REMINDER_TIMINGS.join(" / ")}`);
  }
  try {
    await setReminderTiming(auth.userId, body.timing);
    return NextResponse.json({ timing: body.timing });
  } catch (error) {
    return serverError("journal:settings", error, "儲存提醒設定失敗");
  }
}
