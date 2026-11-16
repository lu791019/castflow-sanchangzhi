/** Route handler 共用：安全讀 JSON、統一錯誤回應（不外洩內部細節） */

import { NextResponse } from "next/server";

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export function serverError(scope: string, error: unknown, publicMessage: string): NextResponse {
  console.error(`[${scope}]`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: publicMessage }, { status: 500 });
}
