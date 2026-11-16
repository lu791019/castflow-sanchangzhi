/**
 * 記一筆 sheet 的預載資料（UX-29、UX-28）：社交殼掛上就抓 /api/journal/sheet，
 * 點圓鈕時「最近記過的」已經在了，不再停在骨架；401 ＝ 訪客。
 * （社交殼 layout 不在本批可改範圍，改由 provider 掛載時預載，效果等同 SSR 帶入）
 */

import type { RecentLogWork } from "@/lib/journal/recent-works";
import { DEFAULT_REMINDER_TIMING, isReminderTiming, type ReminderTiming } from "@/lib/journal/types";

export interface SheetBoot {
  guest: boolean;
  recent: RecentLogWork[];
  timing: ReminderTiming;
}

/** 讀不到（網路斷、500）時 sheet 照常可記：沒有最近作品、預設提醒 */
export const FALLBACK_BOOT: SheetBoot = { guest: false, recent: [], timing: DEFAULT_REMINDER_TIMING };

export async function fetchSheetBoot(signal?: AbortSignal): Promise<SheetBoot> {
  const response = await fetch("/api/journal/sheet", { signal });
  if (response.status === 401) return { ...FALLBACK_BOOT, guest: true };
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { works?: RecentLogWork[]; timing?: unknown };
  return {
    guest: false,
    recent: Array.isArray(body.works) ? body.works : [],
    timing: isReminderTiming(body.timing) ? body.timing : DEFAULT_REMINDER_TIMING,
  };
}
