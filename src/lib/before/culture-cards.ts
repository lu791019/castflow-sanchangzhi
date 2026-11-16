/**
 * 散場之前：文化部藝文活動與多來源活動（KKTIX／OPENTIX／Accupass／北美館，events/select.ts 合併過）→ 卡片（純函式）。
 * 排進行程沿用場外流程（名稱＋場地＋日期進記一筆場外變體，server 依名稱＋日期歸回同一本場刊），不另建資料表。
 * 社群場刊已有同一場（同類、名稱正規化相同、日期相近）就只留場刊那張。
 */

import { cityShortName } from "@/lib/events/city";
import type { CultureSession, SelectedCultureEvent } from "@/lib/events/culture";
import type { SourcedEvent } from "@/lib/events/select";
import { liveSubcategoryOf } from "@/lib/events/subcategory";
import { dayGap, MAX_DAY_GAP, programmeRange } from "@/lib/venue/match";
import { liveKey } from "@/lib/venue/name";
import type { BeforeCard, LiveWorkRow } from "./cards";
import { fullDate, LIVE_DEFAULT_TIME, shortDate } from "./format";

/** 記一筆「日期」欄最多一年（venue/dates.ts）；展期更長就留空，以去的那天為準 */
const MAX_DATES_SPAN_DAYS = 366;
const DAY_MS = 86_400_000;

function spanDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

/** 展至：同一年寫 MM.DD，跨年寫 YYYY.MM.DD */
function untilLabel(end: string, today: string): string {
  return end.slice(0, 4) === today.slice(0, 4) ? shortDate(end) : fullDate(end);
}

function dateLabel(event: SelectedCultureEvent, today: string): string {
  const { start, end } = event.session;
  if (event.kind === "exhibition") {
    if (start > today) return `${shortDate(start)} 開展`;
    return end ? `展至 ${untilLabel(end, today)}` : shortDate(start);
  }
  return end ? `${shortDate(start)} – ${shortDate(end)}` : shortDate(start);
}

function planDates(event: SelectedCultureEvent): string {
  const { start, end } = event.session;
  if (!end) return fullDate(start);
  if (event.kind === "exhibition" && spanDays(start, end) > MAX_DATES_SPAN_DAYS) return "";
  return `${fullDate(start)} – ${fullDate(end)}`;
}

/** 演出還沒開始才預填（場次時間，沒寫就 19:30）；展覽什麼時候去由人決定 */
function planCustom(event: SelectedCultureEvent, today: string): string {
  const { start, time } = event.session;
  if (event.kind !== "live" || start < today) return "";
  return `${start}T${time ?? LIVE_DEFAULT_TIME}`;
}

/** 場地前面的縣市簡稱；沒有縣市資料、或場地名已經寫了（臺北市立美術館、台北小巨蛋）就不加 */
function cityLabel({ city, venue }: CultureSession): string | null {
  if (!city) return null;
  const short = cityShortName(city);
  return (venue ?? "").replaceAll("台", "臺").includes(short) ? null : short;
}

/** 文化部的卡（origin 沒寫或 culture）標 fromCulture；多來源的卡標 eventSource，①底部依此列資料來源 */
export function cultureCard(event: SourcedEvent, today: string): BeforeCard {
  const { session } = event;
  const subcategory = liveSubcategoryOf(event);
  const label = event.kind === "exhibition" ? "展覽" : event.festival ? "音樂祭" : "演出";
  const fromCulture = !event.origin || event.origin === "culture";
  return {
    key: fromCulture ? `culture:${event.uid}` : `event:${event.uid}`,
    title: event.title,
    posterUrl: event.imageUrl,
    meta: [label, cityLabel(session), session.venue, dateLabel(event, today)].filter(Boolean).join("・"),
    placeholder: event.kind,
    coverDetails: { venue: session.venue, eventDate: session.start, eventEndDate: session.end },
    workId: null,
    plan: {
      type: "live",
      place: event.kind,
      name: event.title,
      venue: session.venue ?? "",
      dates: planDates(event),
      custom: planCustom(event, today),
    },
    ...(event.link ? { link: { href: event.link.url, label: event.link.ticket ? "購票" : "活動頁" } } : {}),
    ...(fromCulture ? { fromCulture: true as const } : { eventSource: event.origin as Exclude<SourcedEvent["origin"], "culture" | undefined> }),
    ...(subcategory ? { subcategory } : {}),
  };
}

/** 社群場刊已記下同一場的文化部活動拿掉（比照場刊歸併規則：同類、live_key 相同、日期間隔在容許內） */
export function dropCommunityDuplicates<T extends SelectedCultureEvent>(events: readonly T[], community: readonly LiveWorkRow[]): T[] {
  const programmes = community.flatMap((row) => {
    const range = programmeRange(row);
    const key = liveKey(row.title);
    return range && key ? [{ kind: row.kind, key, range }] : [];
  });
  return events.filter((event) => {
    const key = liveKey(event.title);
    const range = { start: event.session.start, end: event.session.end ?? event.session.start };
    return !programmes.some(
      (programme) => programme.kind === event.kind && programme.key === key && dayGap(programme.range, range) <= MAX_DAY_GAP[event.kind],
    );
  });
}
