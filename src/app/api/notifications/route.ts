import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { listNotifications } from "@/lib/notifications/repository";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** App 內通知收件匣：{ notifications（新到舊）, unreadCount } */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await listNotifications(auth.userId));
  } catch (error) {
    return serverError("notifications:list", error, "讀取通知失敗");
  }
}
