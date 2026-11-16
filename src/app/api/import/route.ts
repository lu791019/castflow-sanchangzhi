import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { scheduleEmbeddingSync } from "@/lib/embeddings/server";
import { readJson, serverError } from "@/lib/http";
import { limitImportCommit } from "@/lib/import/rate-limit";
import { createServerImportDeps } from "@/lib/import/server";
import { commitImport } from "@/lib/import/service";
import { outcomeResponse, requireImportUser } from "@/lib/import/api-guard";

export const dynamic = "force-dynamic";

/**
 * 匯入送出（登入＋有筆名）：body { url, workId, confirmed:true }。
 * server 重抓原文 → 以筆名公開發佈、published_at＝原文日期 → 回應後算詞向量。
 * 201 { status:"imported", article:{title,href} }｜409 已經搬過了｜400 沒勾／沒選作品｜422 抓不到。
 */
export async function POST(request: Request) {
  const auth = await requireImportUser();
  if (!auth.ok) return auth.response;
  const limited = limitImportCommit(auth.userId);
  if (limited) return limited;
  const body = (await readJson(request)) as Record<string, unknown> | null;
  try {
    const outcome = await commitImport(createServerImportDeps(), auth.userId, {
      url: body?.url,
      workId: body?.workId,
      confirmed: body?.confirmed,
    });
    if (outcome.status !== "imported") return outcomeResponse(outcome);
    scheduleEmbeddingSync(outcome.episodeId);
    revalidatePath("/me");
    return NextResponse.json({ success: true, data: { status: outcome.status, article: outcome.article } }, { status: 201 });
  } catch (error) {
    return serverError("import/commit", error, "搬文章失敗，再試一次");
  }
}
