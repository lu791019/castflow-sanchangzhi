"use server";

import { GenerationRefusedError } from "@castflow/engine/generate/refusal";
import { LongformSourceTooShortError } from "@castflow/engine/generate/watched";
import type { WatchedPromptInput, WatchedWorkKind } from "@castflow/engine/generate/watched-prompt";
import { getServerNotify } from "@/lib/alerts/notify";
import { generateWatchedLongform, generateWatchedThreads } from "@/lib/anthropic/generate-watched";
import { ownsEpisode } from "@/lib/auth/ownership";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { isVenue, UUID_PATTERN } from "@/lib/journal/types";
import { MAX_COMPANIONS_LENGTH, MAX_TITLE_LENGTH, parseRating } from "@/lib/journal/validate";
import { isTooShortToGenerate } from "@/lib/say/meaningful";
import { listVoiceSamples, recordSpokenSample } from "@/lib/voice/repository";
import { pickPromptSamples } from "@/lib/voice/samples";
import { publishToThreads } from "@castflow/engine/publish/threads";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPostTooLong, WATCHED_LONGFORM_PLATFORM, WATCHED_POST_PLATFORM } from "@/lib/watched/post";
import { loadThreadsDirectConfig } from "@/lib/watched/threads-direct";
import { loadWatchedData, saveWatchedContent, startWatchedEntry, WatchedInputError, type WatchedData } from "@/lib/watched/repository";
import type { Work } from "@/lib/works/format";

type Fail = { ok: false; error: string; reason?: "too_short" | "refused" | "source_too_short" };

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

/** 「看完了」送出：建（或沿用）日誌，回 id，接著去說一段（/say?journal=<id>&next=watched） */
export async function startWatchedAction(raw: unknown): Promise<{ ok: true; journalId: string } | Fail> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  if (!raw || typeof raw !== "object") return { ok: false, error: "資料格式不正確" };
  const body = raw as Record<string, unknown>;
  const rating = parseRating(body.rating);
  if (!rating.ok) return { ok: false, error: rating.error };
  const venue = body.venue ?? "other";
  if (!isVenue(venue)) return { ok: false, error: "場域不在允許清單" };
  const journalId = typeof body.journalId === "string" && body.journalId ? body.journalId : null;
  const workId = typeof body.workId === "string" && UUID_PATTERN.test(body.workId) ? body.workId : null;
  try {
    const id = await startWatchedEntry(userId, {
      journalId,
      workId,
      workTitle: optionalText(body.workTitle, MAX_TITLE_LENGTH),
      rating: rating.value,
      venue,
      companions: optionalText(body.companions, MAX_COMPANIONS_LENGTH),
    });
    return { ok: true, journalId: id };
  } catch (error) {
    if (error instanceof WatchedInputError) return { ok: false, error: error.message };
    return failWith(error, "記下這一筆失敗");
  }
}

async function failWith(error: unknown, label: string): Promise<Fail> {
  const message = error instanceof Error ? error.message : String(error);
  await getServerNotify()("error", `看完了：${label}`, message).catch(() => undefined);
  return { ok: false, error: `${label}，再試一次` };
}

type Authorized = { ok: true; userId: string; data: WatchedData } | Fail;

async function authorize(episodeId: string): Promise<Authorized> {
  if (!UUID_PATTERN.test(episodeId)) return { ok: false, error: "找不到這篇" };
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  if (!(await ownsEpisode(userId, episodeId))) return { ok: false, error: "找不到這篇" };
  const data = await loadWatchedData(episodeId, userId);
  if (!data) return { ok: false, error: "找不到這篇" };
  return { ok: true, userId, data };
}

function promptKind(work: Work | null): WatchedWorkKind {
  return work?.kind ?? "other";
}

function workFacts(work: Work | null): string[] {
  if (!work) return [];
  return [
    work.original_title && work.original_title !== work.title ? `原名：${work.original_title}` : null,
    work.year ? `年份：${work.year}` : null,
    work.credit ? `主創：${work.credit}` : null,
  ].filter((fact): fact is string => Boolean(fact));
}

async function promptInput(userId: string, data: WatchedData): Promise<WatchedPromptInput & { ownVoice: number }> {
  const transcript = data.proof.transcript?.text ?? "";
  const samples = pickPromptSamples(await listVoiceSamples(userId));
  const work = data.proof.work;
  return {
    transcript,
    work: {
      title: work?.title ?? data.proof.episode.title,
      kind: promptKind(work),
      facts: workFacts(work),
    },
    samples,
    ownVoice: samples.length,
  };
}

export type VoiceInfo = { sampleCount: number };

/** 整理成 Threads（或重新整理一版）：覆蓋舊稿 */
export async function generateWatchedPostAction(
  episodeId: string,
): Promise<{ ok: true; post: string; voice: VoiceInfo } | Fail> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  const transcript = auth.data.proof.transcript?.text ?? null;
  if (!transcript) return { ok: false, error: "還在轉成文字，等一下再整理" };
  if (isTooShortToGenerate(transcript)) return { ok: false, error: "沒聽清楚，再說一次，或改用打的。", reason: "too_short" };
  try {
    // 先收原話再挑樣本：這一段本身也是語氣來源，但只有逐字稿、不收 AI 產出
    await recordSpokenSample(auth.userId, episodeId, transcript).catch((cause) =>
      getServerNotify()("warn", "語氣樣本：收錄原話失敗", `episode=${episodeId} ${String(cause)}`),
    );
    const { ownVoice, ...input } = await promptInput(auth.userId, auth.data);
    const post = await generateWatchedThreads(input);
    await saveWatchedContent(auth.userId, episodeId, WATCHED_POST_PLATFORM, post, true);
    return { ok: true, post, voice: { sampleCount: ownVoice } };
  } catch (error) {
    if (error instanceof GenerationRefusedError) {
      return { ok: false, error: "這次沒整理出來。再整理一版，或多說一點。", reason: "refused" };
    }
    return failWith(error, "整理 Threads 失敗");
  }
}

/** 使用者改過的貼文本文（不含星等與連結，那兩個由畫面組） */
export async function saveWatchedPostAction(episodeId: string, body: unknown): Promise<{ ok: true } | Fail> {
  if (typeof body !== "string" || !body.trim()) return { ok: false, error: "貼文是空的" };
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  try {
    await saveWatchedContent(auth.userId, episodeId, WATCHED_POST_PLATFORM, body.trim().slice(0, 2000), false);
    return { ok: true };
  } catch (error) {
    return failWith(error, "儲存貼文失敗");
  }
}

/** 整理成長文（部落格，Q-78／Q-85）：原話不夠長不開放（Q-86） */
export async function generateWatchedLongformAction(
  episodeId: string,
): Promise<{ ok: true; longform: string } | Fail> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  if (!auth.data.proof.transcript?.text) return { ok: false, error: "還在轉成文字，等一下再整理" };
  try {
    const longform = await generateWatchedLongform(await promptInput(auth.userId, auth.data));
    await saveWatchedContent(auth.userId, episodeId, WATCHED_LONGFORM_PLATFORM, longform, true);
    return { ok: true, longform };
  } catch (error) {
    if (error instanceof LongformSourceTooShortError) {
      return { ok: false, error: error.message, reason: "source_too_short" };
    }
    if (error instanceof GenerationRefusedError) {
      return { ok: false, error: "這次沒整理出長文。再多說一點再試。", reason: "refused" };
    }
    return failWith(error, "整理長文失敗");
  }
}

/** 直接發到 Threads（只有站長且已設定權杖，Q-74 B／Q-82）；text 是畫面組好的完整貼文（含星等與連結） */
export async function publishWatchedToThreadsAction(
  episodeId: string,
  text: unknown,
): Promise<{ ok: true; postId: string | null } | Fail> {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "貼文是空的" };
  if (isPostTooLong(text)) return { ok: false, error: "超過 Threads 的 500 字" };
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  try {
    const config = await loadThreadsDirectConfig(auth.userId);
    if (!config) return { ok: false, error: "還沒連 Threads，先用「用 Threads 開啟」" };
    // 防重複送出（連點、重試）：已發過就不再發
    const { data: sent } = await createAdminClient()
      .from("contents")
      .select("status")
      .eq("episode_id", episodeId)
      .eq("user_id", auth.userId)
      .eq("platform", WATCHED_POST_PLATFORM)
      .maybeSingle();
    if ((sent as { status: string } | null)?.status === "published") return { ok: false, error: "這則已經發過了" };
    const result = await publishToThreads(config, text.trim());
    if (!result.success) {
      await getServerNotify()("warn", "看完了：直接發 Threads 失敗", result.error ?? "unknown").catch(() => undefined);
      return { ok: false, error: `Threads 沒收到：${result.error ?? "未知錯誤"}` };
    }
    const { error } = await createAdminClient()
      .from("contents")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("episode_id", episodeId)
      .eq("user_id", auth.userId)
      .eq("platform", WATCHED_POST_PLATFORM);
    if (error) await getServerNotify()("warn", "看完了：已發 Threads 但狀態沒寫回", error.message).catch(() => undefined);
    return { ok: true, postId: result.postId ?? null };
  } catch (error) {
    return failWith(error, "發到 Threads 失敗");
  }
}
