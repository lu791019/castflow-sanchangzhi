"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { saveBeforeCity } from "@/lib/before/city-repository";
import { parseFollowUps, parsePicks, parseQuestionnaire, parseTasteSettings, type FollowUps } from "@/lib/taste/questionnaire";
import { saveQuestionnaire, saveTasteLiveKinds, saveTastePicks } from "@/lib/taste/repository";

type ActionResult = { ok: true; saved: number } | { ok: false; error: string };

const SAVE_FAILED = "沒有存進去，稍後再試一次";

/** ④直接寫散場之前的縣市（「都可以」＝null＝全部縣市）、⑤存成品味資料（設定頁清空時寫空的）；沒答的不寫 */
async function saveFollowUps(userId: string, followUps: FollowUps, now: Date): Promise<void> {
  if (followUps.city !== undefined) await saveBeforeCity(userId, followUps.city, now);
  if (followUps.liveKinds) await saveTasteLiveKinds(userId, followUps.liveKinds, now);
}

/**
 * 問卷送出（或跳過時把已答的存下）：前兩題寫 taste_profiles，挑的作品存成品味資料（不寫日誌，UX-15），
 * ④縣市與⑤演出種類（Q-63，①勾到才有）見 saveFollowUps。
 */
export async function saveTasteOnboardingAction(body: unknown): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const questionnaire = parseQuestionnaire(body);
  if (!questionnaire.ok) return questionnaire;
  const picks = parsePicks((body as Record<string, unknown>).picks);
  if (!picks.ok) return picks;
  const followUps = parseFollowUps(body, questionnaire.value.media);
  if (!followUps.ok) return followUps;
  try {
    const now = new Date();
    await saveQuestionnaire(userId, questionnaire.value);
    const saved = await saveTastePicks(userId, picks.value, now);
    await saveFollowUps(userId, followUps.value, now);
    return { ok: true, saved };
  } catch (error) {
    console.error("[taste] onboarding save failed", { userId, detail: error instanceof Error ? error.message : error });
    return { ok: false, error: SAVE_FAILED };
  }
}

/**
 * 設定頁「品味」：①②整份照存；④縣市、⑤演出種類只帶改到的那題（同問卷驗證，①沒勾到的題不收）。
 * ①取消演出／展覽時不帶④⑤，已存的縣市與演出種類留著不刪（縣市本來就是散場之前的設定；再勾回來會帶出原本選的）。
 */
export async function saveTasteSettingsAction(body: unknown): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const update = parseTasteSettings(body);
  if (!update.ok) return update;
  try {
    const now = new Date();
    await saveQuestionnaire(userId, update.value.questionnaire);
    await saveFollowUps(userId, update.value, now);
    revalidatePath("/me/settings");
    return { ok: true, saved: 0 };
  } catch (error) {
    console.error("[taste] settings save failed", { userId, detail: error instanceof Error ? error.message : error });
    return { ok: false, error: SAVE_FAILED };
  }
}
