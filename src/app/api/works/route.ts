import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { limitWorksApi } from "@/lib/rate-limit/works-api";
import { badRequest, readJson, serverError } from "@/lib/http";
import { allowsAnonymousCreate, parseCreateWorkInput } from "@/lib/work-picker/input";
import { listRecentPicks } from "@/lib/work-picker/repository";
import { PickerNotFoundError, PickerUpstreamError, resolveWork } from "@/lib/work-picker/service";

export const dynamic = "force-dynamic";

/** 「最近看過／聽過」：最近綁定過的作品 ≤ 6 筆 */
export async function GET() {
  // 先說後登入：未登入沒有「最近」，回空清單而不是 401（選擇器照常可搜）
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ success: true, data: { recent: [] } });
  try {
    const recent = await listRecentPicks(userId);
    return NextResponse.json({ success: true, data: { recent } });
  } catch (error) {
    return serverError("works/recent", error, "讀取最近作品失敗");
  }
}

/**
 * 選定作品 → 建立或取回 work。
 * body：{source:"tmdb",kind,tmdbId} | {source:"podcast",feedUrl,guid,itunesId?} | {source:"manual",kind,title}
 * 同 (kind,tmdb_id) 或同 (feed_url,episode_guid) 已存在時回既有列；新建或取回一律 200。
 */
export async function POST(request: NextRequest) {
  const limited = limitWorksApi(request, "works/create");
  if (limited) return limited;
  const parsed = parseCreateWorkInput(await readJson(request));
  if (!parsed.ok) return badRequest(parsed.error);
  if (!allowsAnonymousCreate(parsed.value) && !(await getCurrentUserId())) {
    return NextResponse.json({ success: false, error: "手動輸入要先登入，或從搜尋結果選一部" }, { status: 401 });
  }

  try {
    const work = await resolveWork(parsed.value);
    return NextResponse.json({ success: true, data: { work } });
  } catch (error) {
    if (error instanceof PickerNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof PickerUpstreamError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    return serverError("works/create", error, "建立作品失敗，再試一次");
  }
}
