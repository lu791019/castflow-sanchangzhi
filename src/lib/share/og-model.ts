/**
 * OG 卡資料模型：把分享頁用的原始資料（集數、文章、作品、筆名、日誌）整理成卡片要畫的東西。
 * 純函式；讀 DB 在 og-data.ts。
 */

import { episodeTimeLabel, type EpisodeJournal } from "@/lib/journal/episode-byline";
import { sealFor } from "@/lib/me/seal";
import { displayAuthor, parseByline } from "@/lib/proof/publish";
import { deriveLede, extractPullQuote, extractWorkTitle, issueNumber, parseArticle } from "@/lib/share/article";
import { formatIssueNo } from "@/lib/works/format";
import {
  fitFooter,
  fitOgTitle,
  ogFontText,
  ogImageUrl,
  pickOgVariant,
  plateText,
  podcastText,
  type FittedText,
  type OgVariant,
  type OgWork,
  type PlateText,
  type PodcastText,
} from "./og-card";
import { shortQuote } from "./threads-post";

export interface OgEpisodeRow {
  id: string;
  title: string;
  source: string;
  created_at: string;
  byline: string | null;
  pull_quote: string | null;
}

export interface OgCardInput {
  episode: OgEpisodeRow;
  body: string;
  work: OgWork | null;
  penName: string;
  journal: EpisodeJournal | null;
}

export interface OgCardModel {
  variant: OgVariant;
  issue: string;
  title: FittedText;
  quote: string | null;
  author: string;
  seal: { shape: number; chars: string[] } | null;
  byline: string;
  plate: PlateText;
  podcast: PodcastText | null;
  /** 海報（A）或節目封面（C）網址；B 為 null */
  imageUrl: string | null;
}

export const OG_BRAND = "散場誌";
export const OG_COLUMN = "散場之後";

export function toOgCardModel({ episode, body, work, penName, journal }: OgCardInput): OgCardModel {
  const parsed = parseArticle(body);
  const { blocks } = deriveLede(parsed.blocks);
  const title = parsed.title ?? episode.title;
  const workTitle = work?.title ?? extractWorkTitle(title, episode.title, body);
  const variant = pickOgVariant(work);
  const author = displayAuthor(parseByline(episode.byline) ?? "pen_name", penName);
  const footer = fitFooter(
    author,
    episodeTimeLabel({ createdAt: episode.created_at, source: episode.source, journal }),
  );
  return {
    variant,
    issue: formatIssueNo(issueNumber(episode.id)),
    title: fitOgTitle(title),
    // 作者在校樣選定的引言優先，沒選才自動抽句（與分享頁一致）
    quote: shortQuote(episode.pull_quote ?? extractPullQuote(blocks)),
    author: footer.author,
    seal: sealFor(author),
    byline: footer.byline,
    plate: plateText(work, workTitle),
    podcast: work && variant === "podcast" ? podcastText(work) : null,
    imageUrl: variant === "plate" || !work?.poster_url ? null : ogImageUrl(work.poster_url),
  };
}

/** 卡上所有字（給字型子集） */
export function ogModelText(model: OgCardModel): string {
  return ogFontText([
    OG_COLUMN,
    OG_BRAND,
    "「",
    model.issue,
    model.title.text,
    model.quote,
    model.author,
    model.seal?.chars.join(""),
    model.byline,
    "・",
    model.plate.title,
    model.plate.subtitle,
    model.plate.label,
    model.podcast?.headline,
    model.podcast?.show,
    model.podcast?.episodeTitle,
  ]);
}
