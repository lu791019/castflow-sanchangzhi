/** 匯入 API 共用守衛：要登入、要有筆名（匯入文章一律以筆名署名） */

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getProfilePenName } from "@/lib/me/pen-name";

export type ImportUser = { ok: true; userId: string } | { ok: false; response: NextResponse };

export async function requireImportUser(): Promise<ImportUser> {
  const auth = await requireApiUser();
  if (!auth.ok) return auth;
  try {
    if (await getProfilePenName(auth.userId)) return auth;
  } catch (error) {
    console.error("[import] 讀取筆名失敗", error instanceof Error ? error.message : error);
    return { ok: false, response: NextResponse.json({ success: false, error: "暫時讀不到筆名，再試一次" }, { status: 500 }) };
  }
  return { ok: false, response: NextResponse.json({ success: false, error: "先取筆名才能搬文章" }, { status: 403 }) };
}

const STATUS_CODES = { invalid: 400, failed: 422, duplicate: 409 } as const;

/** 非成功的結果：{ success:false, error, data? }；重複時 data 帶已搬過的那篇 */
export function outcomeResponse(
  outcome: { status: "invalid" | "failed"; error: string } | { status: "duplicate"; existing: { title: string; href: string } },
): NextResponse {
  if (outcome.status === "duplicate") {
    return NextResponse.json(
      { success: false, error: "已經搬過了", data: { status: "duplicate", existing: outcome.existing } },
      { status: STATUS_CODES.duplicate },
    );
  }
  return NextResponse.json({ success: false, error: outcome.error }, { status: STATUS_CODES[outcome.status] });
}
