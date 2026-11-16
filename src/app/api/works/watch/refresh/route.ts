import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-guard";
import { serverError } from "@/lib/http";
import { refreshStaleWatchInfo } from "@/lib/watch/repository";

export const dynamic = "force-dynamic";

/** 給 worker：更新快取過期的「在哪看」（每輪最多 10 筆），x-api-key 守衛 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  try {
    const result = await refreshStaleWatchInfo();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return serverError("works:watch-refresh", error, "更新在哪看失敗");
  }
}
