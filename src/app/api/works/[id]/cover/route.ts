import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { coversPublicPrefix } from "@/lib/covers/storage";
import { workExists } from "@/lib/covers/submissions";
import { submitWorkCover } from "@/lib/covers/submit-service";
import { parseCoverUrl } from "@/lib/covers/upload";
import { badRequest, readJson, serverError } from "@/lib/http";
import { UUID_PATTERN } from "@/lib/journal/types";
import { limitCoverUpload } from "@/lib/rate-limit/covers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function notFound(): NextResponse {
  return NextResponse.json({ success: false, error: "找不到這個作品" }, { status: 404 });
}

/**
 * 場刊「補封面」（Q-47，登入）：body { url }——貼的 https 圖片網址，或 /api/covers 上傳後拿到的自家桶網址。
 * 走補封面共用流程（外部網址 server 轉存；白名單直接補空的 poster_url → 201 approved；其餘 202 pending）。
 * 抓不到圖 422（已推警報）。
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const limited = limitCoverUpload(auth.userId);
  if (limited) return limited;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notFound();

  const body = (await readJson(request)) as Record<string, unknown> | null;
  const parsed = parseCoverUrl(body?.url, coversPublicPrefix());
  if (!parsed.ok) return badRequest(parsed.error);
  if (!parsed.value) return badRequest("請貼圖片網址或上傳一張圖");

  try {
    if (!(await workExists(id))) return notFound();
    const result = await submitWorkCover({ workId: id, userId: auth.userId, url: parsed.value });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.reason === "invalid" ? 400 : 422 });
    }
    const data = result.status === "approved" ? { status: result.status, posterUrl: result.posterUrl } : { status: result.status };
    return NextResponse.json({ success: true, data }, { status: result.status === "approved" ? 201 : 202 });
  } catch (error) {
    return serverError("works/cover:post", error, "補封面失敗，再試一次");
  }
}
