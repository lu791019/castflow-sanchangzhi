import { runClaudePrint, type RunClaudePrintOptions } from "../llm/client";
import {
  buildSystemPrompt,
  buildMultiPlatformPrompt,
  buildSinglePlatformPrompt,
} from "./generate-content-prompt";
import { Platform, StyleDimensions } from "../types";
import { BLOG_MAX_CHARS, buildShortenPrompt, countChineseChars } from "./article-length";
import { findRefusal, GenerationRefusedError, isRefusal } from "./refusal";

export type GenerateAlertLevel = "warn" | "error";

/** 警報出口（app 層注入 notify()）；engine 不碰任何外推管道 */
export type GenerateNotify = (
  level: GenerateAlertLevel,
  title: string,
  detail?: string,
) => unknown;

export interface GenerateOptions extends RunClaudePrintOptions {
  notify?: GenerateNotify;
}

/**
 * Blog 字數保護：超過上限重試一次（帶「超過 n 字，請縮短」）；
 * 仍超過就保留結果並 notify 警告——不靜默截斷。
 */
export async function enforceBlogLimit(
  blog: string,
  basePrompt: string,
  options?: GenerateOptions,
): Promise<string> {
  const firstCount = countChineseChars(blog);
  if (firstCount <= BLOG_MAX_CHARS) return blog;

  const retried = (await runClaudePrint(buildShortenPrompt(basePrompt, blog), options)).trim();
  const retriedCount = countChineseChars(retried);
  if (retried && retriedCount <= BLOG_MAX_CHARS) return retried;

  const kept = retried || blog;
  const detail = `首次 ${firstCount} 字、重試後 ${retried ? `${retriedCount} 字` : "空白（沿用首次）"}，上限 ${BLOG_MAX_CHARS} 字；已保留結果未截斷`;
  if (options?.notify) {
    await options.notify("warn", "Blog 文章超過字數上限", detail);
  } else {
    console.warn(`[generate] Blog 文章超過字數上限（未注入 notify）：${detail}`);
  }
  return kept;
}

/** 帶拒絕標記：警報後拋 GenerationRefusedError（呼叫端不得寫入正文） */
async function rejectRefusal(results: Readonly<Record<string, string>>, options?: GenerateOptions): Promise<void> {
  const platform = findRefusal(results);
  if (!platform) return;
  const error = new GenerationRefusedError(platform, results[platform]);
  const detail = `平台 ${platform}：${error.excerpt}`;
  if (options?.notify) {
    await options.notify("warn", "AI 沒有整理出文章（原話不足）", detail);
  } else {
    console.warn(`[generate] AI 沒有整理出文章（未注入 notify）：${detail}`);
  }
  throw error;
}

/**
 * 一次生成多平台時，只有文章（blog）拒絕才算整篇失敗；
 * 社群平台拒絕（例：觀影感想不適合 LinkedIn 的職場語調）是預期內的「這則不寫」，留空、不警報。
 */
function dropRefusedSocial(results: Readonly<Record<Platform, string>>): Record<Platform, string> {
  const refused = (Object.keys(results) as Platform[]).filter((p) => p !== "blog" && isRefusal(results[p]));
  if (refused.length === 0) return { ...results };
  console.info(`[generate] 社群貼文略過（AI 判斷不適合）：${refused.join("、")}`);
  return Object.fromEntries(
    (Object.keys(results) as Platform[]).map((p) => [p, refused.includes(p) ? "" : results[p]]),
  ) as Record<Platform, string>;
}

export async function generateAllPlatforms(
  transcript: string,
  styleDna?: StyleDimensions,
  options?: GenerateOptions,
): Promise<Record<Platform, string>> {
  const prompt = `${buildSystemPrompt()}\n\n${buildMultiPlatformPrompt(transcript, styleDna)}`;
  const text = await runClaudePrint(prompt, options);

  // Extract JSON from response (handles possible markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse generated content: no JSON found");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;

  // Validate all platforms are present
  const platforms: Platform[] = [
    "threads",
    "facebook",
    "instagram",
    "linkedin",
    "blog",
    "newsletter",
  ];
  for (const p of platforms) {
    if (!parsed[p]) {
      throw new Error(`Missing content for platform: ${p}`);
    }
  }

  await rejectRefusal({ blog: parsed.blog }, options);
  const results = dropRefusedSocial(parsed as Record<Platform, string>);
  const blogPrompt = `${buildSystemPrompt()}\n\n${buildSinglePlatformPrompt(transcript, "blog", styleDna)}`;
  const blog = await enforceBlogLimit(results.blog, blogPrompt, options);
  return { ...results, blog };
}

export async function generateSinglePlatform(
  transcript: string,
  platform: Platform,
  styleDna?: StyleDimensions,
  options?: GenerateOptions,
): Promise<string> {
  const prompt = `${buildSystemPrompt()}\n\n${buildSinglePlatformPrompt(transcript, platform, styleDna)}`;
  const text = await runClaudePrint(prompt, options);
  await rejectRefusal({ [platform]: text }, options);
  return platform === "blog" ? enforceBlogLimit(text, prompt, options) : text;
}
