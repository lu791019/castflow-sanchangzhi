import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/http";
import { parseSearchParams } from "@/lib/work-picker/input";
import { PickerUpstreamError, searchWorks } from "@/lib/work-picker/service";
import { isItunesRateLimited } from "@/lib/work-picker/itunes";
import { limitWorksApi, rateLimitedResponse } from "@/lib/rate-limit/works-api";

export const dynamic = "force-dynamic";

/** 作品搜尋：?kind=movie|series|podcast|music&q=（至少 2 字，上限 100 字）。TMDB / iTunes 只在這裡呼叫 */
export async function GET(request: NextRequest) {
  const limited = limitWorksApi(request, "works/search");
  if (limited) return limited;
  const parsed = parseSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) return badRequest(parsed.error);
  const { kind, query } = parsed.value;

  try {
    const results = await searchWorks(kind, query);
    return NextResponse.json({ success: true, data: { kind, query, results } });
  } catch (error) {
    if (error instanceof PickerUpstreamError && isItunesRateLimited(error.cause)) {
      return rateLimitedResponse(60_000, kind === "music" ? "音樂搜尋太熱門了，一分鐘後再試" : "Podcast 搜尋太熱門了，一分鐘後再試");
    }
    if (error instanceof PickerUpstreamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    return serverError("works/search", error, "搜尋失敗，再試一次");
  }
}
