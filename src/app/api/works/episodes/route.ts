import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/http";
import { parseFeedParam } from "@/lib/work-picker/input";
import { PickerUpstreamError, loadPodcastEpisodes } from "@/lib/work-picker/service";
import { limitWorksApi } from "@/lib/rate-limit/works-api";

export const dynamic = "force-dynamic";

/** Podcast 第二層：?feed=<rss url> → 節目資訊 + 集數列表（最多 200 集） */
export async function GET(request: NextRequest) {
  const limited = limitWorksApi(request, "works/episodes");
  if (limited) return limited;
  const parsed = parseFeedParam(request.nextUrl.searchParams.get("feed"));
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const data = await loadPodcastEpisodes(parsed.value);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PickerUpstreamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    return serverError("works/episodes", error, "讀取集數失敗，再試一次");
  }
}
