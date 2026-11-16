import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-guard";
import { refreshMissingCovers } from "@/lib/covers/repository";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** 給 worker：既有沒圖的 Podcast 作品補封面（每輪最多 10 筆），x-api-key 守衛 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  try {
    const result = await refreshMissingCovers();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return serverError("works:covers-refresh", error, "補封面失敗");
  }
}
