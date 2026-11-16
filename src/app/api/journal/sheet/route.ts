import { NextResponse } from "next/server";
import { getServerNotify } from "@/lib/alerts/notify";
import { requireApiUser } from "@/lib/auth/api";
import { listRecentLogWorks } from "@/lib/journal/recent-works";
import { getReminderTiming } from "@/lib/journal/repository";
import { DEFAULT_REMINDER_TIMING } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

async function warn(detail: string): Promise<void> {
  await getServerNotify()("warn", "記一筆預載失敗", detail).catch(() => undefined);
}

function reason(result: PromiseRejectedResult): string {
  return result.reason instanceof Error ? result.reason.message : String(result.reason);
}

/**
 * 記一筆 sheet 預載（UX-29）：社交殼一掛上就抓，點圓鈕時「最近記過的」已經在了。
 * { works（最近 5 部）, timing（提醒設定）}；未登入 401（訪客，UX-28 靠這個分辨）。
 * 任一項讀不到不擋記一筆：退回空列／預設設定，並推警報。
 */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const [works, timing] = await Promise.allSettled([listRecentLogWorks(auth.userId), getReminderTiming(auth.userId)]);
  if (works.status === "rejected") await warn(`最近作品：${reason(works)}`);
  if (timing.status === "rejected") await warn(`提醒設定：${reason(timing)}`);
  return NextResponse.json({
    works: works.status === "fulfilled" ? works.value : [],
    timing: timing.status === "fulfilled" ? timing.value : DEFAULT_REMINDER_TIMING,
  });
}
