import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { subscribeRss, validateFeedUrl } from "@/lib/ingest/rss";
import { RssIngestError, RSS_ERROR_STATUS } from "@/lib/ingest/rss-errors";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請提供 JSON body" }, { status: 400 });
  }

  const validationError = validateFeedUrl(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await subscribeRss(auth.userId, (body as { feedUrl: string }).feedUrl);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof RssIngestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: RSS_ERROR_STATUS[error.code] },
      );
    }
    const message = error instanceof Error ? error.message : "RSS 訂閱失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
