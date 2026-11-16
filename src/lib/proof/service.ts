/**
 * 校樣服務：發佈 / 存草稿 / 計數。
 * 存取層以 ProofRepo 注入，服務本身不認識 Supabase（測試用假 repo）。
 */

import { isRefusal } from "@castflow/engine/generate/refusal";
import {
  generateShareSlug,
  isListed,
  nextOrdinal,
  normalizePickedQuote,
  parseByline,
  parseVisibility,
  type Byline,
  type Visibility,
} from "./publish";

export interface ProofEpisodeRecord {
  id: string;
  source: string;
  work_id: string | null;
  share_slug: string | null;
  published_at: string | null;
}

export interface EpisodePatch {
  visibility?: Visibility;
  byline?: Byline;
  generate_social?: boolean;
  pull_quote?: string | null;
  share_slug?: string;
  published_at?: string;
}

export interface ProofRepo {
  getEpisode(id: string): Promise<ProofEpisodeRecord | null>;
  slugExists(slug: string): Promise<boolean>;
  updateEpisode(id: string, patch: EpisodePatch): Promise<void>;
  /**
   * 作品底下「公開且已發佈、非 RSS」的感受數（不含 excludeId）；
   * publishedUpTo 有值時只算在那之前（含）發佈的（已發佈文章回看時序數不漂移）
   */
  countListedWorkFeelings(workId: string, excludeId: string, publishedUpTo?: string | null): Promise<number>;
  /** 作者已發佈篇數（非 RSS，不含 excludeId；publishedUpTo 同上） */
  countAuthorPublished(excludeId: string, publishedUpTo?: string | null): Promise<number>;
  /** 刪掉社群平台（非 blog）的草稿貼文 */
  deleteSocialDrafts(episodeId: string): Promise<void>;
  /** 校樣正文（blog）；沒有回 null */
  getBlogBody(episodeId: string): Promise<string | null>;
}

export interface ProofSettingsInput {
  visibility: unknown;
  byline: unknown;
  generateSocial: unknown;
  quote: unknown;
}

export interface ValidSettings {
  visibility: Visibility;
  byline: Byline;
  generateSocial: boolean;
  quote: string | null;
}

export class ProofError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofError";
  }
}

export function validateSettings(input: ProofSettingsInput): ValidSettings {
  const visibility = parseVisibility(input.visibility);
  if (!visibility) throw new ProofError("公開範圍不正確");
  const byline = parseByline(input.byline);
  if (!byline) throw new ProofError("署名設定不正確");
  if (typeof input.generateSocial !== "boolean") throw new ProofError("社群貼文設定不正確");
  const quote = normalizePickedQuote(input.quote);
  if (quote === "invalid") throw new ProofError("引言格式不正確");
  return { visibility, byline, generateSocial: input.generateSocial, quote };
}

export interface ProofCounts {
  /** 這篇是作者的第幾篇 */
  authorOrdinal: number;
  /** 公開且有綁作品時：特輯裡的第幾段；否則 null */
  workOrdinal: number | null;
}

export async function computeCounts(
  repo: ProofRepo,
  episode: Pick<ProofEpisodeRecord, "id" | "work_id" | "published_at">,
  visibility: Visibility,
): Promise<ProofCounts> {
  const upTo = episode.published_at;
  const [authorCount, workCount] = await Promise.all([
    repo.countAuthorPublished(episode.id, upTo),
    episode.work_id && isListed(visibility)
      ? repo.countListedWorkFeelings(episode.work_id, episode.id, upTo)
      : Promise.resolve(null),
  ]);
  return {
    authorOrdinal: nextOrdinal(authorCount),
    workOrdinal: workCount === null ? null : nextOrdinal(workCount),
  };
}

const SLUG_ATTEMPTS = 5;

export type RandomBytes = (size: number) => Uint8Array;

async function ensureShareSlug(
  repo: ProofRepo,
  episode: ProofEpisodeRecord,
  random: RandomBytes,
): Promise<string> {
  if (episode.share_slug) return episode.share_slug;
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const slug = generateShareSlug(random);
    if (!(await repo.slugExists(slug))) return slug;
  }
  throw new ProofError("產生文章連結失敗，請再試一次");
}

async function requireEpisode(repo: ProofRepo, episodeId: string): Promise<ProofEpisodeRecord> {
  const episode = await repo.getEpisode(episodeId);
  if (!episode) throw new ProofError("找不到這篇");
  return episode;
}

/** 存草稿：只寫設定與引言，不發佈 */
export async function saveDraftSettings(
  repo: ProofRepo,
  episodeId: string,
  input: ProofSettingsInput,
): Promise<ValidSettings> {
  const settings = validateSettings(input);
  await requireEpisode(repo, episodeId);
  await repo.updateEpisode(episodeId, {
    visibility: settings.visibility,
    byline: settings.byline,
    generate_social: settings.generateSocial,
    pull_quote: settings.quote,
  });
  return settings;
}

/** 擋在 server：沒有正文、或正文是模型的拒絕訊息（【無法生成】），一律不能發佈（UX-02） */
async function requirePublishableBody(repo: ProofRepo, episodeId: string): Promise<void> {
  const body = await repo.getBlogBody(episodeId);
  if (!body?.trim()) throw new ProofError("還沒有整理好的正文，無法發佈");
  if (isRefusal(body)) throw new ProofError("這篇沒有整理成功，不能發佈。再整理一版，或改用打的。");
}

export interface PublishResult extends ProofCounts {
  shareSlug: string;
  visibility: Visibility;
  publishedAt: string;
}

export interface PublishDeps {
  repo: ProofRepo;
  random: RandomBytes;
  now: () => Date;
}

/**
 * 確認發佈：產生 share_slug（已有則沿用）、寫入公開狀態與設定、首次發佈記錄時間；
 * 關閉「同時產生 6 平台貼文」時清掉社群草稿。
 */
export async function publishProof(
  deps: PublishDeps,
  episodeId: string,
  input: ProofSettingsInput,
): Promise<PublishResult> {
  const settings = validateSettings(input);
  const episode = await requireEpisode(deps.repo, episodeId);
  if (episode.source === "rss") throw new ProofError("RSS 節目不是你的感受，無法發佈");
  await requirePublishableBody(deps.repo, episodeId);

  const shareSlug = await ensureShareSlug(deps.repo, episode, deps.random);
  const publishedAt = episode.published_at ?? deps.now().toISOString();

  await deps.repo.updateEpisode(episodeId, {
    visibility: settings.visibility,
    byline: settings.byline,
    generate_social: settings.generateSocial,
    pull_quote: settings.quote,
    share_slug: shareSlug,
    published_at: publishedAt,
  });
  if (!settings.generateSocial) await deps.repo.deleteSocialDrafts(episodeId);

  const counts = await computeCounts(deps.repo, episode, settings.visibility);
  return { ...counts, shareSlug, visibility: settings.visibility, publishedAt };
}
