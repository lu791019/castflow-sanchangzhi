"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/auth/owned-reads";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { cancelEpisodeSchedule, rescheduleEpisode, type DeskMutationResult } from "@/lib/me/desk-repository";

type ActionResult = { ok: true } | { ok: false; error: string };

function toActionResult(result: DeskMutationResult): ActionResult {
  return result.ok ? result : { ok: false, error: result.error };
}

async function run(scope: string, task: (userId: string) => Promise<DeskMutationResult>): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  try {
    const result = toActionResult(await task(userId));
    if (result.ok) revalidatePath("/me/desk");
    return result;
  } catch (error) {
    console.error(`[desk] ${scope} failed`, error instanceof Error ? error.message : error);
    return { ok: false, error: "沒有存進去，稍後再試一次" };
  }
}

/** 改排程時間（只動自己這篇排程中的貼文） */
export async function rescheduleAction(episodeId: unknown, iso: unknown): Promise<ActionResult> {
  if (typeof episodeId !== "string" || !isUuid(episodeId) || typeof iso !== "string") {
    return { ok: false, error: "時間格式不對" };
  }
  return run("reschedule", (userId) => rescheduleEpisode(userId, episodeId, iso));
}

/** 取消排程：貼文回到草稿 */
export async function cancelScheduleAction(episodeId: unknown): Promise<ActionResult> {
  if (typeof episodeId !== "string" || !isUuid(episodeId)) return { ok: false, error: "找不到這篇" };
  return run("cancel", (userId) => cancelEpisodeSchedule(userId, episodeId));
}
