import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { UUID_PATTERN } from "@/lib/journal/types";
import { markNotificationsRead } from "@/lib/notifications/repository";
import { badRequest, readJson, serverError } from "@/lib/http";

const MAX_IDS = 100;

/** 標已讀：{ ids: [...] } 標指定通知；{ all: true } 全部標已讀 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = (await readJson(request)) as { ids?: unknown; all?: unknown } | null;
  let ids: string[] | null;
  if (body?.all === true) {
    ids = null;
  } else if (
    Array.isArray(body?.ids) &&
    body.ids.length > 0 &&
    body.ids.length <= MAX_IDS &&
    body.ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id))
  ) {
    ids = body.ids as string[];
  } else {
    return badRequest(`需要 ids（1-${MAX_IDS} 個 uuid）或 all: true`);
  }

  try {
    const updated = await markNotificationsRead(auth.userId, ids);
    return NextResponse.json({ updated });
  } catch (error) {
    return serverError("notifications:read", error, "標記已讀失敗");
  }
}
