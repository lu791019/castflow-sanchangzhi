import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-guard";
import { refreshEmbeddings } from "@/lib/embeddings/sync";
import { createServerEmbeddingDeps } from "@/lib/embeddings/server";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** 給 worker：公開筆名文章補算詞向量（每輪最多 10 篇沒算過或內文改過的），x-api-key 守衛 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  try {
    const result = await refreshEmbeddings(createServerEmbeddingDeps());
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return serverError("episodes:embeddings-refresh", error, "補算詞向量失敗");
  }
}
