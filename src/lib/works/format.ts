/** 作品特輯：期號、作品 meta、時間標籤、標題處理等純邏輯 */

export type WorkKind = "movie" | "series" | "podcast_episode" | "live" | "exhibition" | "music";

export interface Work {
  id: string;
  kind: WorkKind;
  title: string;
  original_title: string | null;
  year: number | null;
  region: string | null;
  credit: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  podcast_show: string | null;
  episode_number: number | null;
  synopsis: string | null;
  slug: string;
  issue_no: number;
  created_at: string;
  /** 演出／展覽場地（migration 014）；其他類型為 null */
  venue?: string | null;
  /** 演出／展覽日期 YYYY-MM-DD（migration 014） */
  event_date?: string | null;
}

export const WORK_COLUMNS =
  "id, kind, title, original_title, year, region, credit, poster_url, tmdb_id, podcast_show, episode_number, synopsis, slug, issue_no, created_at, venue, event_date";

export const WORK_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const ISSUE_PAD = 4;

/** 期號：142 → 第 0142 號（補足 4 位）；已格式化的字串期號照寫 */
export function formatIssueNo(issue: number | string): string {
  return `第 ${typeof issue === "string" ? issue : formatIssueLatin(issue)} 號`;
}

/** 拉丁期號：142 → 0142 */
export function formatIssueLatin(issueNo: number): string {
  return String(Math.max(0, Math.floor(issueNo))).padStart(ISSUE_PAD, "0");
}

export function isPodcast(work: Pick<Work, "kind">): boolean {
  return work.kind === "podcast_episode";
}

/** 音樂（專輯，migration 037）：credit＝歌手／樂團、poster_url＝專輯封面 */
export function isMusic(work: Pick<Work, "kind">): boolean {
  return work.kind === "music";
}

/** 用「聽」的類型（Podcast、音樂）：在哪聽、聽完 */
export function isListenKind(work: Pick<Work, "kind">): boolean {
  return work.kind === "podcast_episode" || work.kind === "music";
}

/** 方形封面（Podcast 節目封面、專輯封面 1:1）；其他是 2:3 海報或字卡 */
export function isSquareCover(work: Pick<Work, "kind">): boolean {
  return isListenKind(work);
}

/** 圖說來源：海報 · TMDB／節目封面／專輯封面 · Apple Music */
export function posterSourceLabel(work: Pick<Work, "kind">): string {
  if (work.kind === "podcast_episode") return "節目封面";
  if (work.kind === "music") return "專輯封面 · Apple Music";
  return "海報 · TMDB";
}

/** 現場類（演出／展覽）：沒有串流平台，INFO 列顯示場地與日期 */
export function isOnSite(work: Pick<Work, "kind">): boolean {
  return work.kind === "live" || work.kind === "exhibition";
}

/** 影視類（電影／影集）：有 TMDB 與「在哪看」 */
export function isScreen(work: Pick<Work, "kind">): boolean {
  return work.kind === "movie" || work.kind === "series";
}

export const KIND_LABELS: Record<WorkKind, string> = {
  movie: "電影",
  series: "影集",
  podcast_episode: "PODCAST",
  live: "演出",
  exhibition: "展覽",
  music: "音樂",
};

const KIND_VERBS: Record<WorkKind, "看" | "聽"> = {
  movie: "看",
  series: "看",
  podcast_episode: "聽",
  // 日誌場域「音樂祭/演出」預設「聽完」，與之一致
  live: "聽",
  exhibition: "看",
  music: "聽",
};

/** 動詞：看過 / 聽過 */
export function workVerb(work: Pick<Work, "kind">): "看" | "聽" {
  return KIND_VERBS[work.kind];
}

/** 作品選擇器 tab：podcast_episode → podcast；現場類沒有搜尋 tab，回到電影 tab（手動輸入可再選類型） */
export function pickerKindForWork(
  work: Pick<Work, "kind"> | null | undefined,
): "movie" | "series" | "podcast" | "music" {
  if (!work) return "movie";
  if (work.kind === "podcast_episode") return "podcast";
  if (work.kind === "music") return "music";
  if (work.kind === "series") return "series";
  return "movie";
}

/** 2026-10-03 → 2026.10.03；格式不符回 null */
export function formatEventDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

/** 現場類 INFO 列：場地、日期（缺的不列） */
export function onSiteInfoRows(
  work: Pick<Work, "venue" | "event_date">,
): Array<{ label: string; value: string }> {
  const date = formatEventDate(work.event_date);
  return [
    work.venue ? { label: "場地", value: work.venue } : null,
    date ? { label: "日期", value: date } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}

/** 稱呼作品：電影《海街日記》、Podcast《The Daily》第 12 集 */
export function workDisplayName(
  work: Pick<Work, "kind" | "title" | "podcast_show" | "episode_number">,
): string {
  if (isPodcast(work) && work.podcast_show) {
    return work.episode_number
      ? `《${work.podcast_show}》第 ${work.episode_number} 集`
      : `《${work.podcast_show}》這一集`;
  }
  return `《${work.title}》`;
}

/** meta 行：2015 · 日本 · 是枝裕和 導演 / 《The Daily》第 12 集 · 主持人 X */
export function workMetaLine(
  work: Pick<
    Work,
    "kind" | "year" | "region" | "credit" | "podcast_show" | "episode_number" | "title"
  > &
    Partial<Pick<Work, "venue" | "event_date">>,
): string {
  if (isPodcast(work)) {
    const parts = [
      work.podcast_show
        ? work.episode_number
          ? `《${work.podcast_show}》第 ${work.episode_number} 集`
          : `《${work.podcast_show}》`
        : null,
      work.credit ? `主持人 ${work.credit}` : null,
    ];
    return parts.filter(Boolean).join(" · ");
  }
  if (isOnSite(work)) {
    return [formatEventDate(work.event_date), work.venue].filter(Boolean).join(" · ");
  }
  if (isMusic(work)) {
    return [work.year ? String(work.year) : null, work.credit].filter(Boolean).join(" · ");
  }
  const parts = [
    work.year ? String(work.year) : null,
    work.region,
    work.credit ? `${work.credit} 導演` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** 字卡大字：Podcast 集數 > 年份 > — */
export function posterCardNumber(
  work: Pick<Work, "kind" | "episode_number" | "year"> & Partial<Pick<Work, "event_date">>,
): string {
  if (isPodcast(work) && work.episode_number) return String(work.episode_number);
  if (work.year) return String(work.year);
  const eventYear = work.event_date ? /^(\d{4})/.exec(work.event_date)?.[1] : undefined;
  if (eventYear) return eventYear;
  return "—";
}

/** 字卡側標：PODCAST・第 121 集 / 電影・日本 / 音樂・告五人 */
export function posterCardLabel(
  work: Pick<Work, "kind" | "episode_number" | "region"> & Partial<Pick<Work, "venue" | "credit">>,
): string {
  if (isMusic(work)) return [KIND_LABELS.music, work.credit].filter(Boolean).join("・");
  if (isPodcast(work)) {
    return work.episode_number
      ? `PODCAST・第 ${work.episode_number} 集`
      : "PODCAST";
  }
  const place = isOnSite(work) ? work.venue : work.region;
  return [KIND_LABELS[work.kind], place].filter(Boolean).join("・");
}

/** 視覺長度：CJK 算 1、拉丁/數字算 0.55（直排時拉丁字橫躺較窄） */
export function visualLength(text: string): number {
  let total = 0;
  for (const char of text) {
    total += /[⺀-鿿豈-﫿＀-￯　-〿]/.test(char)
      ? 1
      : 0.55;
  }
  return total;
}

const VERTICAL_TITLE_MAX = 10;

export interface HeroTitleStyle {
  vertical: boolean;
  letterSpacing: string;
}

/** type.hero.vertical：明體 30 直排，字距依字數 .32em→.18em；過長改橫排避免撐破版面 */
export function heroTitleStyle(title: string): HeroTitleStyle {
  const length = visualLength(title);
  if (length > VERTICAL_TITLE_MAX) return { vertical: false, letterSpacing: "0.02em" };
  if (length <= 4) return { vertical: true, letterSpacing: "0.32em" };
  if (length <= 6) return { vertical: true, letterSpacing: "0.24em" };
  return { vertical: true, letterSpacing: "0.18em" };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 列表時間：剛剛 / N 分鐘前 / N 小時前 / 昨天 / MM.DD（跨年 YYYY.MM.DD） */
export function relativeTimeLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (Number.isNaN(elapsed)) return "—";
  if (elapsed < MINUTE) return "剛剛";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分鐘前`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 小時前`;
  if (elapsed < 2 * DAY) return "昨天";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}.${month}.${day}`;
  }
  return `${month}.${day}`;
}

const TITLE_SEPARATORS = /——|—|：|:|｜|\|/;

/**
 * 去作品名：特輯頁內每篇標題不必再重複作品名。
 * 以分隔符切段、丟掉含《作品》的段；全被丟光時改為只刪掉《作品》字樣。
 */
export function stripWorkTitle(title: string, workTitle: string): string {
  const marker = `《${workTitle}》`;
  if (!title.includes(marker)) return title.trim();
  const segments = title
    .split(TITLE_SEPARATORS)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const kept = segments.filter((segment) => !segment.includes(marker));
  if (kept.length > 0) return kept.join("——");
  const removed = title.replaceAll(marker, "").replace(/^[\s，、：:—-]+|[\s，、：:—-]+$/g, "");
  return removed || title.trim();
}

/** 頭像字：中文取最後一字，其他取首字母大寫 */
export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "？";
  const chars = Array.from(trimmed);
  const last = chars[chars.length - 1];
  if (/[一-鿿]/.test(last)) return last;
  return chars[0].toUpperCase();
}
