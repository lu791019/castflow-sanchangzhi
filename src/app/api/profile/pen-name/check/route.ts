import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { validatePenName } from "@/lib/auth/pen-name-rules";
import { isPenNameAvailable } from "@/lib/me/pen-name";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET ?name= → { success, data: { name, available, reason? } }；需登入（自己目前的筆名算可用） */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = validatePenName(request.nextUrl.searchParams.get("name"));
  if (!parsed.ok) {
    return NextResponse.json({ success: true, data: { available: false, reason: parsed.error } });
  }
  try {
    const available = await isPenNameAvailable(parsed.value, auth.userId);
    return NextResponse.json({
      success: true,
      data: { name: parsed.value, available, ...(available ? {} : { reason: "這個筆名有人用了" }) },
    });
  } catch (error) {
    return serverError("profile:pen-name-check", error, "暫時無法檢查筆名");
  }
}
