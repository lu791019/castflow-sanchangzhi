import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { badRequest, readJson, serverError } from "@/lib/http";
import { UUID_PATTERN } from "@/lib/journal/types";
import { parseLinkInput } from "@/lib/links/input";
import { loadWorkLinks, saveUserLink } from "@/lib/links/repository";
import { limitWorksApi } from "@/lib/rate-limit/works-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function notFound(): NextResponse {
  return NextResponse.json({ success: false, error: "找不到這個作品" }, { status: 404 });
}

/** 作品的在哪看／去哪買票／官網（公開資料，記一筆選定作品後的 client 用）→ { watch, ticket, official, missing } */
export async function GET(request: NextRequest, { params }: Params) {
  const limited = limitWorksApi(request, "works/links");
  if (limited) return limited;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notFound();
  try {
    const loaded = await loadWorkLinks(id);
    if (!loaded) return notFound();
    const { watch, ticket, official, missing } = loaded;
    return NextResponse.json({ success: true, data: { watch, ticket, official, missing } });
  } catch (error) {
    return serverError("works/links:get", error, "讀取連結失敗");
  }
}

/**
 * 「你知道？告訴我們」（登入）：body { kind, url, label? }，只收 http(s)。
 * 寫 origin='user'、added_by=本人；同作品同來源只覆蓋自己補的（別人的或站方的 → 409）。
 * 白名單網域 201 立即公開；白名單外 202 待審。音樂、Podcast 只收 Spotify（類型對不上、短網址 → 400，見 spotify.ts）。
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const limited = limitWorksApi(request, "works/links:post");
  if (limited) return limited;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notFound();
  const parsed = parseLinkInput(await readJson(request));
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const result = await saveUserLink(id, auth.userId, parsed.value);
    if (!result.ok && result.reason === "not_found") return notFound();
    if (!result.ok && result.reason === "invalid") return badRequest(result.error);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: "這個平台已經有連結了" }, { status: 409 });
    }
    return NextResponse.json(
      { success: true, data: { status: result.status, link: result.link } },
      { status: result.status === "active" ? 201 : 202 },
    );
  } catch (error) {
    return serverError("works/links:post", error, "補連結失敗，再試一次");
  }
}
