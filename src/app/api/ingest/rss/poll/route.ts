import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-guard";
import { pollAllFeeds } from "@/lib/ingest/rss";

/** 遍歷訂閱 feeds 檢查新集（x-api-key 守衛，供未來排程呼叫） */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const results = await pollAllFeeds();
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    return NextResponse.json({ success: true, totalAdded, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll 失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
