import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { isUuid } from "@/lib/auth/owned-reads";
import { deleteDraft } from "@/lib/me/desk-repository";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * 刪除自己的草稿（編輯檯 5 秒可救回後才真的呼叫；離開頁面時以 keepalive 送出）。
 * 不是自己的或不存在 → 404，已發佈 → 409。
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: "找不到這篇" }, { status: 404 });
  try {
    const result = await deleteDraft(auth.userId, id);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("me:drafts:delete", error, "刪除失敗，稍後再試");
  }
}
