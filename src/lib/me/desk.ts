/**
 * 編輯檯（設計稿 P2 編輯檯 A–E）：把自己的集數分成草稿／排程中／已發佈三疊，並產生每列文案。
 * 一篇只會出現在一疊：有排程中的社群貼文 → 排程中；否則已發佈 → 已發佈；其餘 → 草稿。
 * 訂閱節目自動進來的集數（source = rss）不是自己說的，不上編輯檯。
 */

import { issueNumber } from "@/lib/share/article";
import { formatIssueNo, KIND_LABELS, type WorkKind } from "@/lib/works/format";
import { parseVisibility, VISIBILITY_OPTIONS } from "@/lib/proof/publish";
import { pad2, taipeiParts, taipeiDateKey, DAY_MS } from "@/lib/journal/time";

export type DeskTab = "drafts" | "scheduled" | "published";
export const DESK_TABS: readonly DeskTab[] = ["drafts", "scheduled", "published"];
export const DESK_TAB_LABELS: Record<DeskTab, string> = {
  drafts: "草稿",
  scheduled: "排程中",
  published: "已發佈",
};

export interface DeskWork {
  kind: WorkKind;
  title: string;
  poster_url: string | null;
  podcast_show: string | null;
  episode_number: number | null;
}

export interface DeskContentRow {
  platform: string;
  status: string;
  scheduled_at: string | null;
  body: string;
  original_body: string | null;
}

export interface DeskEpisodeRow {
  id: string;
  title: string;
  source: string;
  status: string;
  created_at: string;
  published_at: string | null;
  share_slug: string | null;
  visibility: string;
  work: DeskWork | null;
  contents: DeskContentRow[];
}

/** 列首小圖：海報 / 直排字卡 / podcast 方形字卡 / 斜線佔位（沒綁作品） */
export type DeskThumb =
  | { kind: "poster"; url: string }
  | { kind: "plate"; text: string }
  | { kind: "pod"; text: string; no: string }
  | { kind: "hatch" };

interface DeskRowBase {
  id: string;
  title: string;
  eyebrow: string;
  thumb: DeskThumb;
  /** 六平台社群貼文都已產出時，連到舊的內容編輯器（次要小連結，Q-55）；沒有就 null */
  socialHref: string | null;
}

export interface DraftRow extends DeskRowBase {
  status: string;
  /** 校樣到一半：顯示半條進度線 */
  half: boolean;
  time: string;
  href: string;
}

export interface ScheduledRow extends DeskRowBase {
  scheduledAt: string;
  platforms: string;
  /** 文章本身已刊出（只剩社群貼文排程）；取消排程時不會回到草稿 */
  published: boolean;
  href: string;
}

export interface PublishedRow extends DeskRowBase {
  meta: string;
  href: string;
}

export interface DeskData {
  drafts: DraftRow[];
  scheduled: ScheduledRow[];
  published: PublishedRow[];
}

const PLATFORM_LABELS: Record<string, string> = {
  threads: "Threads",
  facebook: "FB",
  instagram: "IG",
  linkedin: "LinkedIn",
  newsletter: "電子報",
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const SOCIAL_PLATFORMS = ["threads", "facebook", "instagram", "linkedin", "newsletter"] as const;

/** 社群貼文入口：blog 以外五個平台都有內容才給連結 */
export function socialPostsHref(row: Pick<DeskEpisodeRow, "id" | "contents">): string | null {
  const ready = SOCIAL_PLATFORMS.every((platform) =>
    row.contents.some((content) => content.platform === platform && content.body.trim()),
  );
  return ready ? `/episodes/${row.id}/edit` : null;
}

function blogOf(row: DeskEpisodeRow): DeskContentRow | undefined {
  return row.contents.find((content) => content.platform === "blog");
}

function scheduledContents(row: DeskEpisodeRow): DeskContentRow[] {
  return row.contents.filter((content) => content.status === "scheduled" && content.scheduled_at);
}

export function deskTabOf(row: DeskEpisodeRow): DeskTab {
  if (scheduledContents(row).length > 0) return "scheduled";
  if (row.published_at) return "published";
  return "drafts";
}

export function deskThumb(work: DeskWork | null): DeskThumb {
  if (!work) return { kind: "hatch" };
  if (work.kind === "podcast_episode") {
    return {
      kind: "pod",
      text: work.podcast_show ?? work.title,
      no: work.episode_number ? String(work.episode_number) : "",
    };
  }
  if (work.poster_url) return { kind: "poster", url: work.poster_url };
  return { kind: "plate", text: work.title };
}

/** 「影集・請回答1988」「Podcast・慢慢說　第 121 集」；沒綁作品 →「還沒選作品」 */
export function deskEyebrow(work: DeskWork | null): string {
  if (!work) return "還沒選作品";
  if (work.kind === "podcast_episode") {
    const show = work.podcast_show ?? work.title;
    const no = work.episode_number ? `　第 ${work.episode_number} 集` : "";
    return `Podcast・${show}${no}`;
  }
  return `${KIND_LABELS[work.kind]}・${work.title}`;
}

/** 草稿狀態行：依轉錄／整理／校樣進度 */
export function draftStatus(row: DeskEpisodeRow): { status: string; half: boolean } {
  const blog = blogOf(row);
  if (blog) {
    const edited = blog.original_body !== null && blog.original_body !== blog.body;
    return edited ? { status: "校樣到一半", half: true } : { status: "整理好了，還沒校樣", half: false };
  }
  if (row.status === "error") return { status: "沒有轉成文字", half: false };
  if (row.status === "transcribed") return { status: "文字在，還沒整理", half: false };
  return { status: "還在轉成文字", half: false };
}

/** 列表時間（台北）：今天 09:12 / 昨天 23:40 / 10.06（跨年 2025.10.06） */
export function deskTimeLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = taipeiParts(date);
  const clock = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  if (taipeiDateKey(date) === taipeiDateKey(now)) return `今天 ${clock}`;
  if (taipeiDateKey(date) === taipeiDateKey(new Date(now.getTime() - DAY_MS))) return `昨天 ${clock}`;
  const day = `${pad2(parts.month)}.${pad2(parts.day)}`;
  return parts.year === taipeiParts(now).year ? day : `${parts.year}.${day}`;
}

/** 時段：早上 / 中午 / 下午 / 晚上（排程時間用） */
function periodOf(hour: number): string {
  if (hour < 11) return "早上";
  if (hour < 13) return "中午";
  if (hour < 18) return "下午";
  return "晚上";
}

/** 排程時間：「10.12 週一 早上 9:00」（台北） */
export function scheduleWhenLabel(iso: string): string {
  const date = new Date(iso);
  const parts = taipeiParts(date);
  const weekday = WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
  return `${pad2(parts.month)}.${pad2(parts.day)} 週${weekday} ${periodOf(parts.hour)} ${parts.hour}:${pad2(parts.minute)}`;
}

/** 距離發佈：「還有 1 天 11 小時」「還有 3 小時」「還有 20 分鐘」；過了 →「時間到了，發佈中」 */
export function timeLeftLabel(iso: string, now: Date): string {
  const left = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(left) || left <= 0) return "時間到了，發佈中";
  const minutes = Math.floor(left / 60_000);
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  if (days > 0) return hours > 0 ? `還有 ${days} 天 ${hours} 小時` : `還有 ${days} 天`;
  if (hours > 0) return `還有 ${hours} 小時`;
  return `還有 ${Math.max(1, minutes)} 分鐘`;
}

function visibilityLabel(value: string): string {
  const visibility = parseVisibility(value) ?? "public";
  return VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? "公開";
}

/** 已發佈列：「第 0142 號・10.08 發佈・公開」（期號與分享頁 No. 相同） */
export function publishedMeta(row: Pick<DeskEpisodeRow, "id" | "published_at" | "visibility">): string {
  const parts = taipeiParts(new Date(row.published_at ?? ""));
  const date = Number.isNaN(parts.month) ? "—" : `${pad2(parts.month)}.${pad2(parts.day)}`;
  return `${formatIssueNo(issueNumber(row.id))}・${date} 發佈・${visibilityLabel(row.visibility)}`;
}

function scheduledPlatforms(contents: DeskContentRow[]): string {
  const labels = contents.map((content) => PLATFORM_LABELS[content.platform] ?? content.platform);
  return [...new Set(labels)].join("、");
}

function earliest(isoList: string[]): string {
  return [...isoList].sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

export function buildDesk(rows: DeskEpisodeRow[], now: Date): DeskData {
  const own = rows.filter((row) => row.source !== "rss");
  const base = (row: DeskEpisodeRow): DeskRowBase => ({
    id: row.id,
    title: row.title,
    eyebrow: deskEyebrow(row.work),
    thumb: deskThumb(row.work),
    socialHref: socialPostsHref(row),
  });
  const proofHref = (row: DeskEpisodeRow) => `/proof/${row.id}`;

  const drafts = own
    .filter((row) => deskTabOf(row) === "drafts")
    .map((row) => ({ ...base(row), ...draftStatus(row), time: deskTimeLabel(row.created_at, now), href: proofHref(row) }));

  const scheduled = own
    .filter((row) => deskTabOf(row) === "scheduled")
    .map((row) => {
      const pending = scheduledContents(row);
      return {
        ...base(row),
        scheduledAt: earliest(pending.map((content) => content.scheduled_at as string)),
        platforms: scheduledPlatforms(pending),
        published: Boolean(row.published_at),
        href: proofHref(row),
      };
    })
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));

  const published = own
    .filter((row) => deskTabOf(row) === "published")
    .sort((a, b) => Date.parse(b.published_at ?? "") - Date.parse(a.published_at ?? ""))
    .map((row) => ({
      ...base(row),
      meta: publishedMeta(row),
      href: row.share_slug ? `/s/${row.share_slug}` : proofHref(row),
    }));

  return { drafts, scheduled, published };
}

/** 頂部統計：「3 份草稿・1 篇排程中・12 篇已發佈」；全空 →「還沒有草稿，也還沒發佈過。」 */
export function deskStatLine(desk: DeskData): string {
  const { drafts, scheduled, published } = desk;
  if (drafts.length + scheduled.length + published.length === 0) return "還沒有草稿，也還沒發佈過。";
  return `${drafts.length} 份草稿・${scheduled.length} 篇排程中・${published.length} 篇已發佈`;
}

export function parseDeskTab(value: string | undefined): DeskTab {
  return DESK_TABS.find((tab) => tab === value) ?? "drafts";
}
