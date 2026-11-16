import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** VAPID 公鑰（前端 pushManager.subscribe 的 applicationServerKey）；未設定回 503 */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json({ error: "Web Push 尚未設定" }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}
