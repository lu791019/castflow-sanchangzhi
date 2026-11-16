/**
 * 多來源藝文活動（Q-62）共用的資料形狀與正規化（純函式）：worker 解析器產出、ingest API 驗證寫入、散場之前讀取都用這一份。
 * 本機 worker 直接用 node 跑 TS，這支只能用相對路徑 import（不能用 @/ 別名）。
 */

import { liveKey } from "../venue/name.ts";

export const EVENT_SOURCES = [
  "kktix",
  "opentix",
  "accupass",
  "tfam",
  // 館方展覽來源（Q-62 續，10/15）：開放資料兩館＋館方網站列表
  "nmns",
  "nmmba",
  "songshan",
  "nstm",
  "tnam",
  "ntm",
  "nmh",
  "cksmh",
  "clab",
  "moca",
  "kdmofa",
] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

/** 細類；兩大類（演出／展覽）由 eventKindOf 推 */
export const EVENT_CATEGORIES = ["performance", "concert", "festival", "theatre", "dance", "exhibition"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventKind = "live" | "exhibition";

export interface ShowTime {
  /** YYYY-MM-DD（台北日期） */
  date: string;
  /** HH:MM；沒寫回 null */
  time: string | null;
}

export interface TicketUrl {
  source: EventSource;
  url: string;
}

export interface CollectedEvent {
  source: EventSource;
  sourceId: string;
  title: string;
  category: EventCategory;
  venue: string | null;
  city: string | null;
  /** YYYY-MM-DD */
  startsOn: string;
  /** YYYY-MM-DD；單日活動同 startsOn */
  endsOn: string;
  showTimes: ShowTime[];
  ticketUrls: TicketUrl[];
  imageUrl: string | null;
  sourceUrl: string;
}

export const MAX_TITLE_LENGTH = 200;
export const MAX_VENUE_LENGTH = 200;
export const MAX_SHOW_TIMES = 200;
export const MAX_TICKET_URLS = 10;
const MAX_URL_LENGTH = 2000;
const MAX_SOURCE_ID_LENGTH = 200;
const MAX_NORM_KEY_LENGTH = 300;
const MAX_VENUE_KEY_LENGTH = 80;

export function eventKindOf(category: EventCategory): EventKind {
  return category === "exhibition" ? "exhibition" : "live";
}

const FESTIVAL = /音樂祭|音樂節|fest/i;
/** 影展、電影節、放映：電影交給 TMDB，不收（攝影展、光影展不算） */
const FILM = /(?<![攝光])影展|電影節|短片|放映|film\s*festival/i;
/** 「展演」「發展」「展開」不算展覽 */
const EXHIBITION = /特展|展覽|個展|聯展|大展|雙年展|三年展|典藏展|故事展|插畫展|攝影展|畫展|藝術展|(?<!發|開|展)展(?!演|開|現|出|翅|望|售)/;
const THEATRE = /音樂劇|舞台劇|劇團|劇場|讀劇|戲劇|話劇|歌仔戲|京劇|崑劇|豫劇|布袋戲|偶戲/;
const DANCE = /舞蹈|舞團|舞集|舞作|舞劇|芭蕾|現代舞|踢踏/;
const CONCERT = /演唱會|音樂會|交響|管風琴|鋼琴|提琴|室內樂|合唱|獨奏|重奏|協奏|爵士|樂團|國樂|演奏|巡迴|巡演|world\s*tour|fan\s*concert/i;
/** 喜劇、脫口秀：是演出但不是音樂會（「單口喜劇專場巡迴」不算音樂會） */
const COMEDY = /喜劇|脫口秀|單口|漫才|大喜利|相聲/;

/** 只看標題推細類：影展回 "film"、看不出來回 null */
export function titleCategory(title: string): EventCategory | "film" | null {
  if (FILM.test(title)) return "film";
  if (FESTIVAL.test(title)) return "festival";
  if (EXHIBITION.test(title)) return "exhibition";
  if (THEATRE.test(title)) return "theatre";
  if (DANCE.test(title)) return "dance";
  if (!COMEDY.test(title) && CONCERT.test(title)) return "concert";
  return null;
}

/** 標題推細類；看不出來就用來源給的類別。影展回 null（不收） */
export function classifyTitle(title: string, fallback: EventCategory): EventCategory | null {
  const category = titleCategory(title);
  return category === "film" ? null : (category ?? fallback);
}

/** 課程、講座、場地租借、品酒、測試活動、商展：不是散場之前要的藝文活動 */
const NOISE =
  /課|講座|講堂|第[一二三四五六七八九十\d]+講|工作坊|研習|讀書會|分享會|招生|諮詢|說明會|徵件|徵選|志工|培訓|培力|招募|導覽|[^\p{Script=Han}]?班$|彈唱班|入門班|進階班|租借|場地|測試|驗證|加購|品酒|紅酒|微醺|下午茶|頌缽|音缽|靜心|冥想|正念|塔羅|電器|家電|空調|建材|婚紗|旅展|車展|寵物展|美食展|食品展|卡牌|文具|博覽會|展售|特賣|簽售|簽名會/u;

export function isNoiseTitle(title: string): boolean {
  return NOISE.test(title);
}

/** 22 縣市（一律「臺」） */
export const CITIES = [
  "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣",
  "彰化縣", "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣",
] as const;
const CITY_PATTERN = new RegExp(CITIES.map((city) => city.replace("臺", "[臺台]")).join("|"));

const ENGLISH_CITIES: Record<string, string> = {
  "taipei city": "臺北市",
  "new taipei city": "新北市",
  "taoyuan city": "桃園市",
  "taichung city": "臺中市",
  "tainan city": "臺南市",
  "kaohsiung city": "高雄市",
  "keelung city": "基隆市",
  "hsinchu city": "新竹市",
  "chiayi city": "嘉義市",
  "hsinchu county": "新竹縣",
  "miaoli county": "苗栗縣",
  "changhua county": "彰化縣",
  "nantou county": "南投縣",
  "yunlin county": "雲林縣",
  "chiayi county": "嘉義縣",
  "pingtung county": "屏東縣",
  "yilan county": "宜蘭縣",
  "hualien county": "花蓮縣",
  "taitung county": "臺東縣",
  "penghu county": "澎湖縣",
  "kinmen county": "金門縣",
  "lienchiang county": "連江縣",
};

/** 地址開頭的簡寫（「北市中山區…」） */
const SHORT_CITIES: ReadonlyArray<[RegExp, string]> = [
  [/^北市/, "臺北市"],
  [/^新北(?!市)/, "新北市"],
  [/^中市/, "臺中市"],
  [/^南市/, "臺南市"],
  [/^高市/, "高雄市"],
];

/** 地址（或英文城市名）→ 縣市；台一律寫成臺 */
export function cityFromAddress(address: string | null | undefined): string | null {
  const text = (address ?? "").trim();
  if (!text) return null;
  const english = ENGLISH_CITIES[text.toLowerCase()];
  if (english) return english;
  const match = CITY_PATTERN.exec(text);
  if (match) return match[0].replace("台", "臺");
  return SHORT_CITIES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** 場地正規化：NFKC、去標點空白、台→臺、拿掉開頭的縣市 */
function venueKey(venue: string | null): string {
  if (!venue) return "";
  const key = (liveKey(venue) ?? "").replaceAll("台", "臺");
  // 「臺北市大安森林公園」拿掉縣市；「臺北市立美術館」的「市立」不拆
  const withoutCity = key.replace(new RegExp(`^(?:${CITIES.join("|")})(?!立)`), "");
  return Array.from(withoutCity).slice(0, MAX_VENUE_KEY_LENGTH).join("");
}

/** 去重鍵：標題正規化＋起始日＋場地正規化（最多 300 字） */
export function eventNormKey(event: { title: string; startsOn: string; venue: string | null }): string {
  const title = liveKey(event.title) ?? "";
  const key = `${title}|${event.startsOn}|${venueKey(event.venue)}`;
  if (Array.from(key).length <= MAX_NORM_KEY_LENGTH) return key;
  const tail = `|${event.startsOn}|${venueKey(event.venue)}`;
  return `${Array.from(title).slice(0, MAX_NORM_KEY_LENGTH - Array.from(tail).length).join("")}${tail}`;
}

/** 多來源售票連結聯集：同網址只留一次，保留先後順序 */
export function unionTicketUrls(lists: ReadonlyArray<readonly TicketUrl[]>): TicketUrl[] {
  const seen = new Set<string>();
  return lists.flat().filter((ticket) => {
    if (seen.has(ticket.url)) return false;
    seen.add(ticket.url);
    return true;
  });
}

// ── ingest 邊界驗證 ──

type Raw = Record<string, unknown>;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isRealDay(value: unknown): value is string {
  const match = DAY.exec(text(value));
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

export function httpsUrl(value: unknown): string | null {
  const url = text(value);
  if (!/^https:\/\//i.test(url) || url.length > MAX_URL_LENGTH || !URL.canParse(url)) return null;
  return url;
}

function isSource(value: unknown): value is EventSource {
  return typeof value === "string" && (EVENT_SOURCES as readonly string[]).includes(value);
}

function isCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && (EVENT_CATEGORIES as readonly string[]).includes(value);
}

function boundedText(value: unknown, max: number): string | null {
  const trimmed = text(value);
  return trimmed && Array.from(trimmed).length <= max ? trimmed : null;
}

function showTimesOf(value: unknown): ShowTime[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SHOW_TIMES).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Raw;
    if (!isRealDay(raw.date)) return [];
    const time = text(raw.time);
    return [{ date: text(raw.date), time: TIME.test(time) ? time : null }];
  });
}

function ticketUrlsOf(value: unknown): TicketUrl[] {
  if (!Array.isArray(value)) return [];
  const tickets = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Raw;
    const url = httpsUrl(raw.url);
    return isSource(raw.source) && url ? [{ source: raw.source, url }] : [];
  });
  return unionTicketUrls([tickets]).slice(0, MAX_TICKET_URLS);
}

/** 一筆外來活動 → 驗證過的 CollectedEvent；必填壞掉回 null，可選欄位壞掉就清掉 */
export function validateCollectedEvent(value: unknown): CollectedEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Raw;
  const sourceId = boundedText(raw.sourceId, MAX_SOURCE_ID_LENGTH);
  const title = boundedText(raw.title, MAX_TITLE_LENGTH);
  const sourceUrl = httpsUrl(raw.sourceUrl);
  if (!isSource(raw.source) || !sourceId || !title || !isCategory(raw.category) || !sourceUrl) return null;
  if (!isRealDay(raw.startsOn) || !isRealDay(raw.endsOn)) return null;
  const startsOn = text(raw.startsOn);
  const endsOn = text(raw.endsOn);
  if (endsOn < startsOn) return null;
  const city = text(raw.city);
  return {
    source: raw.source,
    sourceId,
    title,
    category: raw.category,
    venue: boundedText(raw.venue, MAX_VENUE_LENGTH),
    city: (CITIES as readonly string[]).includes(city) ? city : null,
    startsOn,
    endsOn,
    showTimes: showTimesOf(raw.showTimes),
    ticketUrls: ticketUrlsOf(raw.ticketUrls),
    imageUrl: httpsUrl(raw.imageUrl),
    sourceUrl,
  };
}
