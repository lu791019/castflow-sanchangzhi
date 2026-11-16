/** 新用戶品味問卷的輸入驗證（純函式）：不信任任何外部 body */

import { normalizeCity } from "@/lib/events/city";
import type { LiveSubcategory } from "@/lib/events/subcategory";
import { UUID_PATTERN } from "@/lib/journal/types";
import { isLiveKind, orderLiveKinds } from "./live-kinds";
import { asksCity, asksLiveKinds } from "./steps";
import { isMediaKey, isTasteSetting, MEDIA_KEYS, type MediaKey, type Questionnaire } from "./types";

export const MAX_PICKS = 3;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface TastePick {
  workId: string;
  /** true＝看過、false＝想看；兩者都只當品味資料，不寫日誌（UX-15，見 picks.ts） */
  seen: boolean;
}

export function parseQuestionnaire(body: unknown): ParseResult<Questionnaire> {
  if (!body || typeof body !== "object") return { ok: false, error: "問卷格式不正確" };
  const raw = body as Record<string, unknown>;
  const media = raw.media ?? [];
  if (!Array.isArray(media) || !media.every(isMediaKey)) return { ok: false, error: "媒介不在清單裡" };
  const setting = raw.setting ?? null;
  if (setting !== null && !isTasteSetting(setting)) return { ok: false, error: "在家／出門不在清單裡" };
  const chosen = new Set<MediaKey>(media);
  return { ok: true, value: { media: MEDIA_KEYS.filter((key) => chosen.has(key)), setting } };
}

export function parsePicks(body: unknown): ParseResult<TastePick[]> {
  if (body === undefined || body === null) return { ok: true, value: [] };
  if (!Array.isArray(body)) return { ok: false, error: "挑的作品格式不正確" };
  const picks: TastePick[] = [];
  for (const item of body as unknown[]) {
    const raw = (item ?? {}) as Record<string, unknown>;
    if (typeof raw.workId !== "string" || !UUID_PATTERN.test(raw.workId)) return { ok: false, error: "作品格式不正確" };
    if (typeof raw.seen !== "boolean") return { ok: false, error: "看過或想看要選一個" };
    if (!picks.some((pick) => pick.workId === raw.workId)) picks.push({ workId: raw.workId, seen: raw.seen });
  }
  if (picks.length > MAX_PICKS) return { ok: false, error: `最多挑 ${MAX_PICKS} 部` };
  return { ok: true, value: picks };
}

/** ④⑤（Q-63）：undefined＝沒答（不寫）；city null＝都可以 */
export interface FollowUps {
  city: string | null | undefined;
  liveKinds: LiveSubcategory[] | undefined;
}

function parseCity(raw: unknown): ParseResult<string | null | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: raw };
  const city = normalizeCity(raw);
  return city ? { ok: true, value: city } : { ok: false, error: "縣市不在清單裡" };
}

function parseLiveKinds(raw: unknown): ParseResult<LiveSubcategory[] | undefined> {
  if (raw === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(raw) || !raw.every(isLiveKind)) return { ok: false, error: "演出種類不在清單裡" };
  const kinds = orderLiveKinds(raw);
  return { ok: true, value: kinds.length > 0 ? kinds : undefined };
}

/** ④⑤只收①勾到的：沒勾演出或展覽不收縣市、沒勾演出不收演出種類（畫面上本來就不會出現） */
export function parseFollowUps(body: unknown, media: readonly MediaKey[]): ParseResult<FollowUps> {
  if (!body || typeof body !== "object") return { ok: false, error: "問卷格式不正確" };
  const raw = body as Record<string, unknown>;
  const city = parseCity(raw.city);
  if (!city.ok) return city;
  const liveKinds = parseLiveKinds(raw.liveKinds);
  if (!liveKinds.ok) return liveKinds;
  if (city.value !== undefined && !asksCity(media)) return { ok: false, error: "沒選演出或展覽，不用回答縣市" };
  if (liveKinds.value !== undefined && !asksLiveKinds(media)) return { ok: false, error: "沒選演出，不用回答演出種類" };
  return { ok: true, value: { city: city.value, liveKinds: liveKinds.value } };
}

/** 設定頁「品味」一次送出的內容：①②整份；④⑤只帶改到的那題（undefined＝不寫） */
export interface TasteSettingsUpdate extends FollowUps {
  questionnaire: Questionnaire;
}

/**
 * 設定頁（①②＋④⑤）：同問卷那一批驗證（parseQuestionnaire＋parseFollowUps，①沒勾到的題一律不收）。
 * 唯一不同：⑤送空陣列＝全部取消，要寫成空的——問卷裡空陣列是「沒答」，設定頁要能把選過的清掉。
 */
export function parseTasteSettings(body: unknown): ParseResult<TasteSettingsUpdate> {
  const questionnaire = parseQuestionnaire(body);
  if (!questionnaire.ok) return questionnaire;
  const media = questionnaire.value.media;
  const followUps = parseFollowUps(body, media);
  if (!followUps.ok) return followUps;
  const raw = (body as Record<string, unknown>).liveKinds;
  const cleared = Array.isArray(raw) && raw.length === 0;
  if (cleared && !asksLiveKinds(media)) return { ok: false, error: "沒選演出，不用回答演出種類" };
  return { ok: true, value: { questionnaire: questionnaire.value, ...followUps.value, liveKinds: cleared ? [] : followUps.value.liveKinds } };
}

/** 媒介複選：點一下加入／移除，順序固定照 MEDIA_KEYS */
export function toggleMedia(selected: readonly MediaKey[], key: MediaKey): MediaKey[] {
  const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key];
  return MEDIA_KEYS.filter((item) => next.includes(item));
}
