"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAllPlatforms } from "@/lib/anthropic/generate-content";
import { GenerationRefusedError } from "@castflow/engine/generate/refusal";
import { isTooShortToGenerate } from "@/lib/say/meaningful";
import type { GenerateFailReason } from "@/lib/proof/failure";
import { pickQuoteCandidates } from "@/lib/anthropic/pick-quotes";
import { ALL_PLATFORMS } from "@/lib/prompts/generate-content";
import {
  normalizeForSave,
  parseProofDocInput,
  proofPlainText,
  serializeProofDoc,
  toProofDoc,
} from "@/lib/proof/document";
import { UUID_PATTERN } from "@/lib/proof/load";
import { normalizePickedQuote, parseStoredCandidates } from "@/lib/proof/publish";
import {
  ProofError,
  publishProof,
  saveDraftSettings,
  type ProofSettingsInput,
  type PublishResult,
} from "@/lib/proof/service";
import { createSupabaseProofRepo } from "@/lib/proof/supabase-repo";
import { markJournalSaidForEpisode } from "@/lib/journal/episode-link";
import { ownsEpisode } from "@/lib/auth/ownership";
import { getCurrentUserId, UNAUTHORIZED_MESSAGE } from "@/lib/auth/session";
import { scheduleEmbeddingSync } from "@/lib/embeddings/server";
import { getServerNotify } from "@/lib/alerts/notify";
import { recordSpokenSample } from "@/lib/voice/repository";

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof ProofError) return { ok: false, error: error.message };
  console.error(`[proof] ${fallback}`, error);
  return { ok: false, error: error instanceof Error ? `${fallback}：${error.message}` : fallback };
}

type Authorized = { ok: true; userId: string } | { ok: false; error: string };

/** 格式 → 登入 → 擁有者；不是自己的文章一律回「找不到這篇」，不透露存在與否 */
async function authorize(episodeId: string): Promise<Authorized> {
  if (!UUID_PATTERN.test(episodeId)) return { ok: false, error: "episodeId 格式不正確" };
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  if (!(await ownsEpisode(userId, episodeId))) return { ok: false, error: "找不到這篇" };
  return { ok: true, userId };
}

/**
 * 存草稿／發佈成功後：連到這篇的視聽日誌標 said。
 * 文章本身已存好，標記失敗不回滾，但記 error log 以便追查（不靜默）。
 */
async function markJournalSaid(userId: string, episodeId: string): Promise<void> {
  try {
    await markJournalSaidForEpisode(userId, episodeId);
  } catch (error) {
    console.error("[proof] 視聽日誌標記 said 失敗", {
      episodeId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function refresh(episodeId: string) {
  revalidatePath(`/proof/${episodeId}`);
}

/** 本人的原話收成語氣樣本（Q-79）；失敗不擋整理，只警報 */
async function collectSpokenSample(userId: string, episodeId: string, transcript: string): Promise<void> {
  try {
    await recordSpokenSample(userId, episodeId, transcript);
  } catch (cause) {
    await getServerNotify()(
      "warn",
      "語氣樣本：收錄原話失敗",
      `episode=${episodeId} ${cause instanceof Error ? cause.message : String(cause)}`,
    ).catch(() => undefined);
  }
}

/** reason：too_short＝原話太少（不送生成）；refused＝模型回【無法生成】（引擎已警報） */
type GenerateResult = { ok: true } | { ok: false; error: string; reason?: GenerateFailReason };

/** 整理（或重新整理一版）：從逐字稿重跑 6 平台生成，覆蓋文案與 AI 原版，清掉舊引言 */
export async function generateProofAction(episodeId: string): Promise<GenerateResult> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  const supabase = createAdminClient();
  try {
    const { data: transcript, error } = await supabase
      .from("transcripts")
      .select("full_text")
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!transcript) return { ok: false, error: "找不到你原本說的內容（逐字稿），無法整理" };
    // 原話太少（例如錄不到人聲只轉出「.」）：不送生成，請他再說一次或改用打的（UX-02）
    if (isTooShortToGenerate(transcript.full_text)) {
      return { ok: false, error: "沒聽清楚，再說一次，或改用打的。", reason: "too_short" };
    }

    await collectSpokenSample(auth.userId, episodeId, transcript.full_text);
    const results = await generateAllPlatforms(transcript.full_text);
    // 只換掉校樣自己的 6 平台；「看完了」的 Threads 貼文與長文（另一個 platform 值）留著
    const { error: deleteError } = await supabase
      .from("contents")
      .delete()
      .eq("episode_id", episodeId)
      .in("platform", ALL_PLATFORMS);
    if (deleteError) throw new Error(deleteError.message);
    const { error: insertError } = await supabase.from("contents").insert(
      ALL_PLATFORMS.map((platform) => ({
        user_id: auth.userId,
        episode_id: episodeId,
        platform,
        body: results[platform],
        original_body: results[platform],
        status: "draft",
      })),
    );
    if (insertError) throw new Error(insertError.message);

    const { error: resetError } = await supabase
      .from("episodes")
      .update({ pull_quote: null, quote_candidates: null })
      .eq("id", episodeId);
    if (resetError) throw new Error(resetError.message);

    refresh(episodeId);
    return { ok: true };
  } catch (error) {
    // 拒絕標記已由引擎警報；不寫入正文，給可重試或改用打的
    if (error instanceof GenerationRefusedError) {
      return { ok: false, error: "這次沒整理出一篇。再整理一版，或改用打的。", reason: "refused" };
    }
    return fail(error, "整理失敗");
  }
}

/** 引言候選：已有快取直接回傳；force 時重挑 */
export async function quoteCandidatesAction(
  episodeId: string,
  force = false,
): Promise<ActionResult<{ candidates: string[] }>> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  const supabase = createAdminClient();
  try {
    const [episodeRes, contentRes] = await Promise.all([
      supabase.from("episodes").select("title, quote_candidates").eq("id", episodeId).maybeSingle(),
      supabase
        .from("contents")
        .select("body")
        .eq("episode_id", episodeId)
        .eq("platform", "blog")
        .limit(1)
        .maybeSingle(),
    ]);
    if (episodeRes.error || !episodeRes.data) return { ok: false, error: "找不到這篇" };
    if (contentRes.error || !contentRes.data) return { ok: false, error: "還沒有整理好的正文" };

    const cached = parseStoredCandidates(episodeRes.data.quote_candidates);
    if (cached.length > 0 && !force) return { ok: true, candidates: cached };

    const text = proofPlainText(toProofDoc(contentRes.data.body, episodeRes.data.title));
    const candidates = await pickQuoteCandidates(text);
    const { error } = await supabase
      .from("episodes")
      .update({ quote_candidates: candidates })
      .eq("id", episodeId);
    if (error) throw new Error(error.message);
    return { ok: true, candidates };
  } catch (error) {
    return fail(error, "挑選引言失敗");
  }
}

/** 存正文（就地編輯後）：序列化回 Markdown，只改 body，AI 原版不動 */
export async function saveProofBodyAction(
  episodeId: string,
  docInput: unknown,
): Promise<ActionResult> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  const doc = parseProofDocInput(docInput);
  if (!doc) return { ok: false, error: "正文格式不正確" };
  const supabase = createAdminClient();
  try {
    const { data: episode } = await supabase
      .from("episodes")
      .select("title")
      .eq("id", episodeId)
      .maybeSingle();
    if (!episode) return { ok: false, error: "找不到這篇" };
    const { data: current } = await supabase
      .from("contents")
      .select("original_body")
      .eq("episode_id", episodeId)
      .eq("platform", "blog")
      .limit(1)
      .maybeSingle();
    const serialized = serializeProofDoc(normalizeForSave(doc, episode.title));
    const originalBody = current?.original_body as string | null | undefined;
    // 內容與 AI 原版相同（例如改完又還原）→ 寫回原版原文，避免格式差異被當成「作者有改」
    const sameAsOriginal =
      originalBody != null &&
      serializeProofDoc(normalizeForSave(toProofDoc(originalBody, episode.title), episode.title)) ===
        serialized;
    const body = sameAsOriginal ? originalBody : serialized;
    const { data, error } = await supabase
      .from("contents")
      .update({ body })
      .eq("episode_id", episodeId)
      .eq("platform", "blog")
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return { ok: false, error: "還沒有整理好的正文" };
    scheduleEmbeddingSync(episodeId);
    return { ok: true };
  } catch (error) {
    return fail(error, "儲存正文失敗");
  }
}

/** 選一句當引言：立即存起來（分享頁與作品特輯會用它） */
export async function selectQuoteAction(episodeId: string, quote: unknown): Promise<ActionResult> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  const normalized = normalizePickedQuote(quote);
  if (normalized === "invalid") return { ok: false, error: "引言格式不正確" };
  const { error } = await createAdminClient()
    .from("episodes")
    .update({ pull_quote: normalized })
    .eq("id", episodeId);
  if (error) return fail(error, "儲存引言失敗");
  return { ok: true };
}

/**
 * 綁定 / 更換 / 取消作品。
 * TODO(work-picker): 作品選擇器完成後改由選擇器呼叫（目前是校樣頁內的簡易下拉）。
 */
export async function bindWorkAction(
  episodeId: string,
  workId: string | null,
): Promise<ActionResult> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  if (workId !== null && !UUID_PATTERN.test(workId)) return { ok: false, error: "作品格式不正確" };
  const supabase = createAdminClient();
  if (workId) {
    const { data } = await supabase.from("works").select("id").eq("id", workId).maybeSingle();
    if (!data) return { ok: false, error: "找不到這部作品" };
  }
  const { error } = await supabase.from("episodes").update({ work_id: workId }).eq("id", episodeId);
  if (error) return fail(error, "綁定作品失敗");
  scheduleEmbeddingSync(episodeId);
  refresh(episodeId);
  return { ok: true };
}

export async function saveDraftAction(
  episodeId: string,
  settings: ProofSettingsInput,
): Promise<ActionResult> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  try {
    await saveDraftSettings(createSupabaseProofRepo(createAdminClient(), auth.userId), episodeId, settings);
    await markJournalSaid(auth.userId, episodeId);
    scheduleEmbeddingSync(episodeId);
    return { ok: true };
  } catch (error) {
    return fail(error, "存草稿失敗");
  }
}

export async function publishProofAction(
  episodeId: string,
  settings: ProofSettingsInput,
): Promise<ActionResult<{ result: PublishResult }>> {
  const auth = await authorize(episodeId);
  if (!auth.ok) return auth;
  try {
    const result = await publishProof(
      {
        repo: createSupabaseProofRepo(createAdminClient(), auth.userId),
        random: (size) => new Uint8Array(randomBytes(size)),
        now: () => new Date(),
      },
      episodeId,
      settings,
    );
    await markJournalSaid(auth.userId, episodeId);
    scheduleEmbeddingSync(episodeId);
    // 校樣頁本身不 revalidate：過場（狀態 D）由 client 依回傳結果呈現，重新整理頁面時 server 也會渲染 D
    revalidatePath("/");
    revalidatePath(`/s/${result.shareSlug}`);
    return { ok: true, result };
  } catch (error) {
    return fail(error, "發佈失敗");
  }
}
