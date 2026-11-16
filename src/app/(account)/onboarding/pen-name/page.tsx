import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginRedirectPath, safeNextPath, tasteOnboardingPath } from "@/lib/auth/paths";
import { getCurrentUserId } from "@/lib/auth/session";
import { getServerNotify } from "@/lib/alerts/notify";
import { getProfilePenName } from "@/lib/me/pen-name";
import { loadSealGlyph } from "@/lib/seal/glyph-repository";
import { PenNameForm } from "./pen-name-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "取個筆名｜散場誌",
};

/** 改筆名時預覽要跟設定頁同一枚印（含換過的印文）；讀不到就照規則畫，並發警報 */
async function currentGlyph(userId: string): Promise<string | null> {
  try {
    return await loadSealGlyph(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await getServerNotify()("warn", "取筆名：讀取印文失敗，預覽照規則畫", `user=${userId} ${message}`).catch(() => undefined);
    return null;
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 第一次打開 B/C：投稿單上簽名。第一次登入時由 proxy 導來；設定頁「筆名」也走這裡（帶 next 回設定） */
export default async function PenNamePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const userId = await getCurrentUserId();
  if (!userId) redirect(loginRedirectPath("/onboarding/pen-name", ""));
  const current = await getProfilePenName(userId);

  // 第一次取筆名：接著做品味問卷；設定頁來改筆名的直接回去
  const after = current ? next : tasteOnboardingPath(next);
  const glyph = current ? await currentGlyph(userId) : null;
  return <PenNameForm next={after} initialPenName={current ?? ""} glyph={glyph} />;
}
