import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-guard";
import { parseIngestBody, runIngest } from "@/lib/events/ingest";
import { createIngestStore } from "@/lib/events/repository";
import { badRequest, readJson, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** 給 worker：一個來源的藝文活動寫進 events（x-api-key 守衛）；Cloud Run 只讀不爬 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  const parsed = parseIngestBody(await readJson(request));
  if (!parsed.ok) return badRequest(parsed.error);
  try {
    const result = await runIngest(createIngestStore(), parsed.source, parsed.events, { invalid: parsed.invalid, now: new Date() });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return serverError("events:ingest", error, "寫入活動失敗");
  }
}
