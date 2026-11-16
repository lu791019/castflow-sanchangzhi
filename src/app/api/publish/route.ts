import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { isSiteOwner } from "@/lib/auth/admin";
import { ownsContent } from "@/lib/auth/ownership";
import { publishContent } from "@/lib/meta/publish";
import { readJson } from "@/lib/http";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { contentId } = ((await readJson(request)) ?? {}) as { contentId?: unknown };
  if (typeof contentId !== "string" || !contentId) {
    return NextResponse.json(
      { error: "contentId is required" },
      { status: 400 },
    );
  }
  // Meta 發佈用全站共用 token：只有站長、且只能發自己的內容；別人的一律 404
  if (!(await isSiteOwner(auth.userId)) || !(await ownsContent(auth.userId, contentId))) {
    return NextResponse.json({ success: false, error: "找不到此內容" }, { status: 404 });
  }

  const result = await publishContent(contentId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, postId: result.postId });
}
