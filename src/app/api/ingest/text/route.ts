import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import {
  ingestText,
  validateTextIngestInput,
  TextIngestGenerationError,
} from "@/lib/ingest/text";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請提供 JSON body" }, { status: 400 });
  }

  const validationError = validateTextIngestInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { episodeId } = await ingestText(auth.userId, body as { title: string; text: string });
    return NextResponse.json({ success: true, episodeId });
  } catch (error) {
    // 生成失敗但 episode 已建立：回傳 episodeId 供既有 UI 重試生成
    if (error instanceof TextIngestGenerationError) {
      return NextResponse.json(
        { error: `文案生成失敗：${error.message}`, episodeId: error.episodeId },
        { status: 500 },
      );
    }
    const message = error instanceof Error ? error.message : "文字匯入失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
