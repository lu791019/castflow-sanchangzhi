/** Route handler 的使用者守衛：未登入回 401 `{success:false,error:"請先登入"}` */

import { NextResponse } from "next/server";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "./session";

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ success: false, error: UNAUTHORIZED_MESSAGE }, { status: 401 });
}

export function notFoundResponse(error = "找不到"): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 404 });
}

export type ApiUser = { ok: true; userId: string } | { ok: false; response: NextResponse };

export async function requireApiUser(): Promise<ApiUser> {
  const userId = await getCurrentUserId();
  return userId ? { ok: true, userId } : { ok: false, response: unauthorizedResponse() };
}
