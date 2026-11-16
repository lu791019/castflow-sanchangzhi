import { NextResponse } from "next/server";
import { readJson, serverError } from "@/lib/http";
import { limitImportPreview } from "@/lib/import/rate-limit";
import { createServerImportDeps } from "@/lib/import/server";
import { previewImport } from "@/lib/import/service";
import { normalizeArticleUrl } from "@/lib/import/url";
import { outcomeResponse, requireImportUser } from "@/lib/import/api-guard";

export const dynamic = "force-dynamic";

/**
 * 匯入預覽（登入＋有筆名；每人每小時 20 篇）：body { url }。
 * 200 { status:"ready", preview }｜409 已經搬過了（data.existing 連到那篇）｜400 網址不對｜422 抓不到／抽不到正文。
 */
export async function POST(request: Request) {
  const auth = await requireImportUser();
  if (!auth.ok) return auth.response;
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const raw = typeof body?.url === "string" ? body.url : "";
  const normalized = normalizeArticleUrl(raw);
  if (!normalized.ok) return outcomeResponse({ status: "invalid", error: normalized.error });
  const limited = limitImportPreview(auth.userId);
  if (limited) return limited;
  try {
    const outcome = await previewImport(createServerImportDeps(normalized.value), auth.userId, raw);
    if (outcome.status !== "ready") return outcomeResponse(outcome);
    return NextResponse.json({ success: true, data: outcome });
  } catch (error) {
    return serverError("import/preview", error, "讀取文章失敗，再試一次");
  }
}
