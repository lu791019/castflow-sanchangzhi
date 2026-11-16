import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { saveBeforeCity } from "@/lib/before/city-repository";
import { loadBeforeView, thisWeekOf, type ThisWeekView } from "@/lib/before/load";
import { parseCityBody } from "@/lib/before/city-setting";
import { badRequest, readJson, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * 散場之前記住「在哪個縣市」：{ city: "臺北市" }（22 縣市之一，台 → 臺）或 { city: null }（全部縣市）。
 * 存好後順便回依新縣市重算的①（thisWeek），畫面直接換、不等 router.refresh；重算失敗回 null（縣市已存，畫面靠 refresh 跟上）。
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const parsed = parseCityBody(await readJson(request));
  if (!parsed.ok) return badRequest("縣市不對：請選 22 縣市之一，或全部縣市");
  try {
    const now = new Date();
    await saveBeforeCity(auth.userId, parsed.city, now);
    return NextResponse.json({ success: true, city: parsed.city, thisWeek: await thisWeekOrNull(auth.userId, now) });
  } catch (error) {
    return serverError("before:city", error, "沒存到，稍後再試");
  }
}

async function thisWeekOrNull(userId: string, now: Date): Promise<ThisWeekView | null> {
  try {
    return thisWeekOf(await loadBeforeView(userId, now));
  } catch (error) {
    console.error("[before:city] 換縣市後重算失敗，畫面改靠 refresh", error instanceof Error ? error.message : error);
    return null;
  }
}
