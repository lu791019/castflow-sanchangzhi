import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { spotifyListenEnabled } from "@/lib/features";
import { serverError } from "@/lib/http";
import { deleteSpotifyConnection } from "@/lib/spotify/connection-repository";

export const dynamic = "force-dynamic";

/** 解除 Spotify 連結（Q-64 C1）：刪掉這位使用者的整列（含加密的 refresh token）→ { connected: false } */
export async function DELETE() {
  if (!spotifyListenEnabled()) return NextResponse.json({ success: false, error: "找不到" }, { status: 404 });
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    await deleteSpotifyConnection(auth.userId);
    return NextResponse.json({ success: true, data: { connected: false } });
  } catch (error) {
    return serverError("spotify/connection:delete", error, "解除連結失敗，再試一次");
  }
}
