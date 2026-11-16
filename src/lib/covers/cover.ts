/**
 * 封面補齊（Dex 10/13 晚：海報要留但不能空）：封面來源優先序與「字卡封面」模型（純函式）。
 * 有圖放圖；沒有圖一律走字卡——紙底、墨線框、直排作品名，場外再加場地與日期（展覽細框、演出圓章）。
 */

export type CoverStyle = "screen" | "podcast" | "music" | "live" | "exhibition";

/** 版位尺寸：決定直排每欄幾字、最多幾欄、帶不帶場地日期 */
export type CoverSize = "xs" | "sm" | "md" | "lg" | "xl";

export type TitleOrientation = "vertical" | "horizontal";

export interface CoverInput {
  kind: string;
  /** 直排大字：作品名；Podcast 由呼叫端給節目名 */
  title: string;
  posterUrl: string | null;
  venue?: string | null;
  /** YYYY-MM-DD */
  eventDate?: string | null;
  eventEndDate?: string | null;
}

export type CoverModel =
  | { type: "image"; url: string }
  | {
      type: "card";
      style: CoverStyle;
      /** 英文為主的片名改橫排（直排會把整個字轉 90 度、又被切欄，UX-25） */
      orientation: TitleOrientation;
      /** 直排：每欄一個字串；橫排：只有一行，交給版面換行 */
      columns: string[];
      venue: string | null;
      date: string | null;
      label: string;
    };

interface SizeRule {
  perColumn: number;
  maxColumns: number;
  details: boolean;
}

export const COVER_SIZE_RULES: Record<CoverSize, SizeRule> = {
  xs: { perColumn: 3, maxColumns: 1, details: false },
  sm: { perColumn: 4, maxColumns: 1, details: false },
  md: { perColumn: 5, maxColumns: 2, details: true },
  lg: { perColumn: 6, maxColumns: 2, details: true },
  xl: { perColumn: 8, maxColumns: 2, details: true },
};

const STYLE_OF_KIND: Record<string, CoverStyle> = {
  movie: "screen",
  series: "screen",
  podcast_episode: "podcast",
  podcast: "podcast",
  music: "music",
  live: "live",
  performance: "live",
  exhibition: "exhibition",
};

const LABEL_OF_KIND: Record<string, string> = {
  movie: "電影",
  series: "影集",
  podcast_episode: "Podcast",
  podcast: "Podcast",
  music: "音樂",
  live: "演出",
  performance: "演出",
  exhibition: "展覽",
};

/** 斷欄點：作品名裡的分隔號（「島嶼夜歌・草地音樂會」在「・」換欄） */
const TITLE_BREAKS = /[・·:：|｜\/／]/;
const ELLIPSIS = "…";

/** 只收 http(s) 網址；其餘（空白、data:、javascript:）當作沒有 */
export function safeImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  return URL.canParse(trimmed) ? trimmed : null;
}

/** Podcast 封面來源優先序：iTunes artworkUrl600 → RSS 的 itunes:image → 沒有 */
export function pickPodcastCover(itunesArtwork: string | null, feedImage: string | null): string | null {
  return safeImageUrl(itunesArtwork) ?? safeImageUrl(feedImage);
}

export function coverStyleOf(kind: string): CoverStyle {
  return STYLE_OF_KIND[kind] ?? "screen";
}

function chunk(chars: string[], size: number): string[] {
  return Array.from({ length: Math.ceil(chars.length / size) }, (_, index) =>
    chars.slice(index * size, (index + 1) * size).join(""),
  );
}

/** 拉丁字母／數字連成的一個字：排版時整個字一起走，不從中間切 */
const LATIN_WORD = /^[A-Za-z0-9À-ɏ'’&.!?-]+$/;
const TOKEN = /[A-Za-z0-9À-ɏ'’&.!?-]+|\s+|./gu;
/** 直排時橫躺的拉丁字約半個方塊字寬 */
const LATIN_WEIGHT = 0.55;
const SPACE_WEIGHT = 0.3;

type Token = { text: string; weight: number; space: boolean };

function tokensOf(segment: string): Token[] {
  return (segment.match(TOKEN) ?? []).map((text) => {
    if (/^\s+$/.test(text)) return { text: " ", weight: SPACE_WEIGHT, space: true };
    const length = Array.from(text).length;
    return { text, weight: LATIN_WORD.test(text) ? length * LATIN_WEIGHT : length, space: false };
  });
}

const weightOf = (tokens: Token[]) => tokens.reduce((sum, token) => sum + token.weight, 0);
const textOf = (tokens: Token[]) => tokens.map((token) => token.text).join("").trim();

/** 比一欄還長的英文字：照字數切成幾欄，每一段自成一欄 */
function splitLongWord(token: Token, perColumn: number): Token[][] {
  const size = Math.max(1, Math.floor(perColumn / LATIN_WEIGHT));
  return chunk(Array.from(token.text), size).map((text) => [{ text, weight: Array.from(text).length * LATIN_WEIGHT, space: false }]);
}

/** 單位逐一裝欄：放不下就換欄；比一欄還長的英文字自己切成幾欄 */
function packTokens(columns: Token[][], tokens: Token[], perColumn: number): Token[][] {
  return tokens.reduce<Token[][]>((acc, token) => {
    const last = acc[acc.length - 1] ?? [];
    if (token.weight > perColumn) return [...acc.filter((column) => column.length), ...splitLongWord(token, perColumn), []];
    if (last.length && weightOf(last) + token.weight > perColumn) return [...acc, [token]];
    return [...acc.slice(0, -1), [...last, token]];
  }, columns);
}

/** 依字重裝欄：以空白分開的一組字盡量不拆（「uxaudit 測試演出」在空白換欄），一組比一欄還長才逐字裝 */
function packColumns(segment: string, perColumn: number): Token[][] {
  const space: Token = { text: " ", weight: SPACE_WEIGHT, space: true };
  return segment.split(" ").reduce<Token[][]>((columns, group) => {
    const tokens = tokensOf(group);
    const groupWeight = weightOf(tokens);
    const last = columns[columns.length - 1] ?? [];
    if (last.length && weightOf(last) + SPACE_WEIGHT + groupWeight <= perColumn) {
      return [...columns.slice(0, -1), [...last, space, ...tokens]];
    }
    if (groupWeight <= perColumn) return [...columns.filter((column) => column.length), tokens];
    return packTokens(last.length ? [...columns, []] : columns, tokens, perColumn);
  }, []);
}

/** 超過欄數：最後一欄從尾巴去掉放不下的單位，留一格給「…」 */
function truncateColumn(tokens: Token[], perColumn: number): string {
  const room = perColumn - 1;
  const fits = tokens.findIndex((_, index) => weightOf(tokens.slice(0, index + 1)) > room);
  const kept = fits === -1 ? tokens : tokens.slice(0, fits);
  const text = kept.length ? textOf(kept) : Array.from(textOf(tokens)).slice(0, Math.max(1, room)).join("");
  return `${text}${ELLIPSIS}`;
}

/** 字卡直排切行：先在分隔號斷欄，太長再按字重換欄（英文字不切半）；超過欄數上限，最後一欄以「…」收尾 */
export function verticalTitleColumns(title: string, perColumn: number, maxColumns: number): string[] {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const columns = clean
    .split(TITLE_BREAKS)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .flatMap((segment) => packColumns(segment, perColumn))
    .filter((column) => textOf(column) !== "");
  if (columns.length <= maxColumns) return columns.map(textOf);
  return [...columns.slice(0, maxColumns - 1).map(textOf), truncateColumn(columns[maxColumns - 1], perColumn)];
}

/** 英文為主（拉丁字重大於方塊字數）的片名改橫排；中文為主照舊直排 */
export function titleOrientation(title: string): TitleOrientation {
  const tokens = tokensOf(title).filter((token) => !token.space);
  const latin = weightOf(tokens.filter((token) => LATIN_WORD.test(token.text)));
  const other = weightOf(tokens.filter((token) => !LATIN_WORD.test(token.text)));
  return latin > other ? "horizontal" : "vertical";
}

const DAY_PATTERN = /^\d{4}-(\d{2})-(\d{2})$/;

function shortDay(day: string | null | undefined): string | null {
  const match = day?.match(DAY_PATTERN);
  return match ? `${match[1]}.${match[2]}` : null;
}

/** 場外日期：單日 MM.DD；區間 MM.DD – MM.DD */
export function coverDateLabel(start: string | null | undefined, end: string | null | undefined): string | null {
  const from = shortDay(start);
  if (!from) return null;
  const to = end && end !== start ? shortDay(end) : null;
  return to ? `${from} – ${to}` : from;
}

export function coverModel(input: CoverInput, size: CoverSize): CoverModel {
  const url = safeImageUrl(input.posterUrl);
  if (url) return { type: "image", url };
  const style = coverStyleOf(input.kind);
  const rule = COVER_SIZE_RULES[size];
  const onSite = rule.details && (style === "live" || style === "exhibition");
  const orientation = titleOrientation(input.title);
  return {
    type: "card",
    style,
    orientation,
    columns:
      orientation === "horizontal"
        ? [input.title.replace(/\s+/g, " ").trim()]
        : verticalTitleColumns(input.title, rule.perColumn, rule.maxColumns),
    venue: onSite ? (input.venue?.trim() || null) : null,
    date: onSite ? coverDateLabel(input.eventDate, input.eventEndDate) : null,
    label: LABEL_OF_KIND[input.kind] ?? "作品",
  };
}
