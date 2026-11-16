import { NextResponse } from "next/server";
import { notFoundResponse, requireApiUser } from "@/lib/auth/api";
import { communityEnabled } from "@/lib/features";
import { readJson, serverError } from "@/lib/http";
import { createRateLimiter } from "@/lib/rate-limit/token-bucket";
import { rateLimitedResponse } from "@/lib/rate-limit/works-api";
import { addResonance, removeResonance, type ToggleResult } from "@/lib/resonance/repository";
import { parseResonanceRequest } from "@/lib/resonance/request";

export const dynamic = "force-dynamic";

/** 每人每分鐘 60 次（留下＋收回合計） */
const limiter = createRateLimiter({ capacity: 60, windowMs: 60_000 });

type Handler = (userId: string, slug: string, hash: string) => Promise<ToggleResult>;

async function handle(request: Request, scope: string, action: Handler): Promise<NextResponse> {
  if (!communityEnabled()) return notFoundResponse();
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const limited = limiter.take(auth.userId);
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterMs, "按得太快了，稍等一下再試");
  const parsed = parseResonanceRequest(await readJson(request));
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  try {
    const result = await action(auth.userId, parsed.slug, parsed.hash);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.mark });
  } catch (error) {
    return serverError(scope, error, "沒有留下，稍後再試");
  }
}

/** 這句我也是：在某段留下記號（要登入） */
export async function POST(request: Request) {
  return handle(request, "resonance:add", addResonance);
}

/** 收回自己的記號 */
export async function DELETE(request: Request) {
  return handle(request, "resonance:remove", removeResonance);
}
