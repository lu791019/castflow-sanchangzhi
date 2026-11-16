/**
 * OG 卡字型（server only）。
 * Satori 不吃 woff2、也沒有系統字型，中文字必須自己給字型檔。思源明體／黑體整套一個字重就 7MB 以上，
 * 入庫會讓映像肥一大截；所以內容卡改向 Google Fonts 用 `text=` 只抓這張卡用到的字（每張約數十 KB），
 * 依「字型＋字重＋字集」快取在記憶體。抓不到就丟錯，由呼叫端改出中性卡並推警報。
 * 中性卡只用固定幾個字，子集字型（11KB）放在 public/og，不依賴網路。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export type OgFontWeight = 400 | 600 | 700;

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: OgFontWeight;
  style: "normal";
}

export const SERIF = "Noto Serif TC";
export const SANS = "Noto Sans TC";

/** 卡片用到的四個字重：明體 700（標題）／600（引言）、黑體 400（署名）／700（刊頭） */
const CARD_FONTS: ReadonlyArray<{ name: string; weight: OgFontWeight }> = [
  { name: SERIF, weight: 700 },
  { name: SERIF, weight: 600 },
  { name: SANS, weight: 400 },
  { name: SANS, weight: 700 },
];

const FETCH_TIMEOUT_MS = 5000;
const CACHE_LIMIT = 200;
const NEUTRAL_FONT_PATH = path.join(process.cwd(), "public", "og", "neutral-serif-tc-700.ttf");

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const cache = new Map<string, Promise<ArrayBuffer>>();

function remember(key: string, load: () => Promise<ArrayBuffer>): Promise<ArrayBuffer> {
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, pending);
  return pending;
}

/** 從 Google Fonts css2 回應取出 truetype/opentype 字型網址（Satori 不吃 woff2） */
export function parseFontUrl(css: string): string | null {
  const match = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css);
  return match ? match[1] : null;
}

/** 抓一個字型字重、只含 text 這些字的子集 */
export async function loadGoogleFont(
  family: string,
  weight: OgFontWeight,
  text: string,
  fetchImpl: FetchLike = fetch,
): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const cssResponse = await fetchImpl(cssUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!cssResponse.ok) throw new Error(`Google Fonts CSS ${cssResponse.status}（${family} ${weight}）`);
  const fontUrl = parseFontUrl(await cssResponse.text());
  if (!fontUrl) throw new Error(`Google Fonts CSS 找不到 truetype 字型（${family} ${weight}）`);
  const fontResponse = await fetchImpl(fontUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!fontResponse.ok) throw new Error(`Google Fonts 字型檔 ${fontResponse.status}（${family} ${weight}）`);
  return fontResponse.arrayBuffer();
}

/** 內容卡四個字重，皆只含 text 的字；任一失敗整體失敗 */
export async function loadCardFonts(text: string, fetchImpl: FetchLike = fetch): Promise<OgFont[]> {
  return Promise.all(
    CARD_FONTS.map(async ({ name, weight }) => ({
      name,
      weight,
      style: "normal" as const,
      data: await remember(`${name}:${weight}:${text}`, () => loadGoogleFont(name, weight, text, fetchImpl)),
    })),
  );
}

/** 中性卡字型（本地子集，不連網） */
export async function loadNeutralFonts(): Promise<OgFont[]> {
  const buffer = await readFile(NEUTRAL_FONT_PATH);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return [{ name: SERIF, weight: 700, style: "normal", data }];
}
