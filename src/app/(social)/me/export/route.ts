import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { buildExportMarkdown, exportFileName } from "@/lib/me/export";
import { loadExportArticles } from "@/lib/me/export-repository";
import { loadPenName } from "@/lib/me/pen-name";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** 匯出自己的全部文章（Markdown 下載）；需登入，只含自己的 */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    const [articles, penName] = await Promise.all([loadExportArticles(auth.userId), loadPenName(auth.userId)]);
    const now = new Date();
    return new NextResponse(buildExportMarkdown(penName, articles, now), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(now)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError("me:export", error, "匯出失敗，稍後再試");
  }
}
