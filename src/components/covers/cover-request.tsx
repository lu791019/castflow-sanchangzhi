/**
 * 場刊「補封面」（Q-47，server）：場刊沒有圖（只有字卡）時才出現。
 * 登入者已送過、還在待審 → 直接顯示「收到了」；其餘顯示次鈕（未登入按了走登入、回原頁）。
 */

import { getServerNotify } from "@/lib/alerts/notify";
import { getCurrentUserId } from "@/lib/auth/session";
import { safeImageUrl } from "@/lib/covers/cover";
import { hasPendingCover } from "@/lib/covers/submissions";
import { CoverRequestForm } from "./cover-request-form";

interface CoverRequestProps {
  workId: string;
  posterUrl: string | null;
  /** 已散場戳會壓到封面下緣外，表單要多留空 */
  stamped?: boolean;
}

async function pendingOf(workId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    return await hasPendingCover(workId, userId);
  } catch (error) {
    const detail = `work=${workId} ${error instanceof Error ? error.message : String(error)}`;
    console.error("[covers] 讀取待審封面失敗", detail);
    void getServerNotify()("warn", "場刊補封面：讀取待審狀態失敗", detail).catch(() => undefined);
    return false;
  }
}

export async function CoverRequest({ workId, posterUrl, stamped = false }: CoverRequestProps) {
  if (safeImageUrl(posterUrl)) return null;
  const userId = await getCurrentUserId();
  const pending = await pendingOf(workId, userId);
  return <CoverRequestForm workId={workId} signedIn={userId !== null} pending={pending} stamped={stamped} />;
}
