import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { countUnreadNotifications } from "@/lib/notifications/repository";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** 底部導航紅點用：{ unreadCount }（只看自己的） */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ unreadCount: await countUnreadNotifications(auth.userId) });
  } catch (error) {
    return serverError("notifications:unread", error, "讀取未讀數失敗");
  }
}
