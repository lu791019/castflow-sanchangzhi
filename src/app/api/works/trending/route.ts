import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/http";
import { limitWorksApi } from "@/lib/rate-limit/works-api";
import { loadTrending } from "@/lib/trending/service";
import { isPickerKind } from "@/lib/trending/types";

export const dynamic = "force-dynamic";

/** 本週熱門：?kind=movie|series|podcast|music；匿名可用；server 快取一小時 */
export async function GET(request: NextRequest) {
  const limited = limitWorksApi(request, "works/trending");
  if (limited) return limited;
  const kind = request.nextUrl.searchParams.get("kind");
  if (!isPickerKind(kind)) return badRequest("kind 必須是 movie、series、podcast 或 music");
  try {
    return NextResponse.json({ success: true, data: await loadTrending(kind) });
  } catch (error) {
    return serverError("works/trending", error, "本週熱門暫時讀不到");
  }
}
