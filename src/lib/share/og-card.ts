/**
 * OG 預覽卡（設計稿 P2「OG 預覽卡 A・有海報／B・直排字卡／C・Podcast」）的純邏輯：
 * 選版型、期號、標題與直排字卡的字級與截斷。字級沿用 token og.scale（24 / 26 / 34 / 44 / 60）。
 * 卡片上的文字不是 LLM 輸出，版面放不下時可以截斷加「…」。
 */

import {
  formatEventDate,
  isPodcast,
  isScreen,
  KIND_LABELS,
  visualLength,
  type Work,
} from "@/lib/works/format";

export type OgVariant = "poster" | "plate" | "podcast";

export type OgWork = Pick<
  Work,
  "kind" | "title" | "poster_url" | "podcast_show" | "episode_number" | "year" | "venue" | "event_date"
>;

export interface FittedText {
  text: string;
  fontSize: number;
}

export interface PlateText {
  title: string;
  titleSize: number;
  subtitle: string | null;
  label: string;
}

export interface PodcastText {
  headline: string;
  show: string | null;
  episodeTitle: string | null;
}

export interface VerticalRun {
  text: string;
  upright: boolean;
}

const COLUMN_NAME = "散場之後";
const ESSAY_LABEL = "隨筆";
const ELLIPSIS = "…";
const UPRIGHT_CHAR = /[⺀-鿿豈-﫿＀-￯　-〿・]/;

/** 右欄標題寬 680：60 兩行約 22 字、44 三行約 42 字（CJK 1、拉丁 0.55） */
const TITLE_STEPS: ReadonlyArray<{ fontSize: number; capacity: number }> = [
  { fontSize: 60, capacity: 22 },
  { fontSize: 44, capacity: 42 },
];

/** 直排作品名：欄高約 530，60 放 7 字、46 放 10 字、36 放 13 字 */
const PLATE_TITLE_STEPS: ReadonlyArray<{ fontSize: number; capacity: number }> = [
  { fontSize: 60, capacity: 7 },
  { fontSize: 46, capacity: 10 },
  { fontSize: 36, capacity: 13 },
];
const PLATE_SUBTITLE_MAX = 10;
const PODCAST_SHOW_MAX = 8;
const PODCAST_HEADLINE_MAX = 9;
const EPISODE_TITLE_MAX = 11;

/** 依視覺長度截到 capacity 內，最後一格留給「…」 */
function clampVisual(text: string, capacity: number): string {
  if (visualLength(text) <= capacity) return text;
  let result = "";
  for (const char of text) {
    if (visualLength(result + char) > capacity - 1) break;
    result += char;
  }
  return `${result.trimEnd()}${ELLIPSIS}`;
}

function fitSteps(text: string, steps: ReadonlyArray<{ fontSize: number; capacity: number }>): FittedText {
  const length = visualLength(text);
  const step = steps.find((candidate) => length <= candidate.capacity);
  if (step) return { text, fontSize: step.fontSize };
  const last = steps[steps.length - 1];
  return { text: clampVisual(text, last.capacity), fontSize: last.fontSize };
}

/** A 有海報（影視且有海報）／C Podcast／其餘一律 B 直排字卡 */
export function pickOgVariant(work: Pick<Work, "kind" | "poster_url"> | null): OgVariant {
  if (!work) return "plate";
  if (isPodcast(work)) return "podcast";
  if (isScreen(work) && work.poster_url) return "poster";
  return "plate";
}

const TMDB_SIZE = /(image\.tmdb\.org\/t\/p\/)(w\d+|original)\//;

/** TMDB 海報換成 w780：左欄 400×630，作品資料常存 w185 縮圖，放大會糊 */
export function ogImageUrl(url: string): string {
  return url.replace(TMDB_SIZE, "$1w780/");
}

/** 明體大標：兩行內用 60，否則 44，再長截斷 */
export function fitOgTitle(title: string): FittedText {
  return fitSteps(title.trim(), TITLE_STEPS);
}

function plateLabel(work: OgWork | null): string {
  if (!work) return ESSAY_LABEL;
  const when = formatEventDate(work.event_date) ?? (work.year ? String(work.year) : null);
  return [KIND_LABELS[work.kind], when].filter(Boolean).join("・");
}

/** B 直排字卡：作品名（直排大字）、場地（現場類）、側標「演出・2026.10.04」 */
export function plateText(work: OgWork | null, fallbackTitle: string | null): PlateText {
  const fitted = fitSteps((work?.title ?? fallbackTitle ?? COLUMN_NAME).trim(), PLATE_TITLE_STEPS);
  const venue = work?.venue?.trim();
  return {
    title: fitted.text,
    titleSize: fitted.fontSize,
    subtitle: venue ? clampVisual(venue, PLATE_SUBTITLE_MAX) : null,
    label: plateLabel(work),
  };
}

/** C Podcast：「EP7」大字＋節目名＋〈單集名〉；沒有集數時大字改放節目名 */
export function podcastText(work: OgWork): PodcastText {
  const show = work.podcast_show?.trim() || null;
  const episodeTitle = work.title.trim() ? `〈${clampVisual(work.title.trim(), EPISODE_TITLE_MAX)}〉` : null;
  if (work.episode_number) {
    return {
      headline: `EP${work.episode_number}`,
      show: show ? clampVisual(show, PODCAST_SHOW_MAX) : null,
      episodeTitle,
    };
  }
  return {
    headline: clampVisual(show ?? KIND_LABELS.podcast_episode, PODCAST_HEADLINE_MAX),
    show: null,
    episodeTitle,
  };
}

/**
 * 直排切段：Satori 不支援 writing-mode，直排改成一字一行；
 * 中文與全形標點直立，連續的拉丁字母數字合成一段，畫成橫躺（同 vertical-rl 的效果）。
 */
export function verticalRuns(text: string): VerticalRun[] {
  return Array.from(text).reduce<VerticalRun[]>((runs, char) => {
    const upright = UPRIGHT_CHAR.test(char);
    const last = runs[runs.length - 1];
    if (last && last.upright === upright) {
      return [...runs.slice(0, -1), { text: last.text + char, upright }];
    }
    return [...runs, { text: char, upright }];
  }, []);
}

/** 卡片上會出現的所有字（去重），給 Google Fonts `text=` 只抓需要的字形 */
export function ogFontText(parts: ReadonlyArray<string | null | undefined>): string {
  return Array.from(new Set(Array.from(parts.filter(Boolean).join("")))).join("");
}

/** 署名列可用寬度（px）：右欄 680 − CastFlow 約 138 − 間距 16 − 印章 54 */
const FOOTER_BUDGET_PX = 472;
const AUTHOR_PX = 26;
const BYLINE_PX = 24;
const BYLINE_SEPARATOR = "・";

/** 估字寬（em）：中文與全形 1、空白 .25、標點 .27、其他拉丁數字 .55 */
function estimateEm(text: string): number {
  let total = 0;
  for (const char of text) {
    if (UPRIGHT_CHAR.test(char)) total += 1;
    else if (char === " ") total += 0.25;
    else if (/[.,:;'’]/.test(char)) total += 0.27;
    else total += 0.55;
  }
  return total;
}

function footerWidth(author: string, byline: string): number {
  const bylineWidth = byline ? estimateEm(`${BYLINE_SEPARATOR}${byline}`) * BYLINE_PX : 0;
  return estimateEm(author) * AUTHOR_PX + bylineWidth;
}

/**
 * 署名列「筆名・10.04 晚上聽完・散場後 40 分鐘說的」不能撞到右邊的 CastFlow：
 * 太寬先拿掉時間差那段，再不行拿掉整段時刻、筆名截斷。
 */
export function fitFooter(author: string, byline: string): { author: string; byline: string } {
  if (footerWidth(author, byline) <= FOOTER_BUDGET_PX) return { author, byline };
  const firstPart = byline.split(BYLINE_SEPARATOR)[0]?.trim() ?? "";
  if (firstPart && footerWidth(author, firstPart) <= FOOTER_BUDGET_PX) return { author, byline: firstPart };
  if (footerWidth(author, "") <= FOOTER_BUDGET_PX) return { author, byline: "" };
  let clipped = "";
  for (const char of author) {
    if (estimateEm(`${clipped}${char}${ELLIPSIS}`) * AUTHOR_PX > FOOTER_BUDGET_PX) break;
    clipped += char;
  }
  return { author: `${clipped}${ELLIPSIS}`, byline: "" };
}
