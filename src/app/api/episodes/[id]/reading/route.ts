import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-guard";
import {
  NoTranscriptError,
  createReadingDeps,
  createReadingRepo,
  generateReading,
  loadReading,
} from "@/lib/reading";

// 長節目分批翻譯可能跑數分鐘
export const maxDuration = 800;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveEpisodeId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return UUID_PATTERN.test(id) ? id : null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** 閱讀頁資料：{segments, summary, chapters, language, status} */
export async function GET(request: NextRequest, context: RouteContext) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const episodeId = await resolveEpisodeId(context);
  if (!episodeId) {
    return NextResponse.json({ error: "Invalid episode id" }, { status: 400 });
  }

  try {
    const reading = await loadReading(createReadingRepo(), episodeId);
    return NextResponse.json(reading);
  } catch (error) {
    console.error(`[reading] GET ${episodeId} 失敗`, error);
    return NextResponse.json(
      { error: errorMessage(error, "Failed to load reading") },
      { status: 500 },
    );
  }
}

/** 產生（或重新產生）雙語 + 摘要 + 章節；worker 在轉錄完成後呼叫 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const episodeId = await resolveEpisodeId(context);
  if (!episodeId) {
    return NextResponse.json({ error: "Invalid episode id" }, { status: 400 });
  }

  try {
    const outcome = await generateReading(await createReadingDeps(), episodeId);
    return NextResponse.json({ success: true, ...outcome });
  } catch (error) {
    if (error instanceof NoTranscriptError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(`[reading] POST ${episodeId} 失敗`, error);
    return NextResponse.json(
      { error: errorMessage(error, "Reading generation failed") },
      { status: 500 },
    );
  }
}
