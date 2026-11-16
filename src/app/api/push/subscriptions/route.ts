import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { parsePushSubscription } from "@/lib/journal/validate";
import { deletePushSubscription, savePushSubscription } from "@/lib/notifications/repository";
import { badRequest, readJson, serverError } from "@/lib/http";

/** 儲存瀏覽器 PushSubscription.toJSON()（使用者授權通知後呼叫） */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const parsed = parsePushSubscription(await readJson(request), request.headers.get("user-agent"));
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    await savePushSubscription(auth.userId, parsed.value);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return serverError("push:subscribe", error, "儲存推播訂閱失敗");
  }
}

/** 取消訂閱：{ endpoint } */
export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = (await readJson(request)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || !body.endpoint) return badRequest("需要 endpoint");

  try {
    await deletePushSubscription(auth.userId, body.endpoint);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("push:unsubscribe", error, "刪除推播訂閱失敗");
  }
}
