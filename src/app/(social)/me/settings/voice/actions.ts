"use server";

import { getServerNotify } from "@/lib/alerts/notify";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { UUID_PATTERN } from "@/lib/journal/types";
import { addPastedSample, deleteVoiceSample, TooManySamplesError } from "@/lib/voice/repository";
import { parsePastedSample, type VoiceSample } from "@/lib/voice/samples";

type Fail = { ok: false; error: string };

async function fail(error: unknown, label: string): Promise<Fail> {
  await getServerNotify()("error", `我的語氣：${label}`, error instanceof Error ? error.message : String(error)).catch(
    () => undefined,
  );
  return { ok: false, error: `${label}，再試一次` };
}

export async function addVoiceSampleAction(raw: unknown): Promise<{ ok: true; sample: VoiceSample } | Fail> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const parsed = parsePastedSample(raw);
  if (!parsed.ok) return parsed;
  try {
    return { ok: true, sample: await addPastedSample(userId, parsed.value) };
  } catch (error) {
    if (error instanceof TooManySamplesError) return { ok: false, error: error.message };
    return fail(error, "存不進去");
  }
}

export async function deleteVoiceSampleAction(id: unknown): Promise<{ ok: true } | Fail> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return { ok: false, error: "找不到這篇" };
  try {
    return (await deleteVoiceSample(userId, id)) ? { ok: true } : { ok: false, error: "找不到這篇" };
  } catch (error) {
    return fail(error, "刪不掉");
  }
}
