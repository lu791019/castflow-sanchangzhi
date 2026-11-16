/** 活動頁共用的小工具（純函式）：JSON-LD、og meta、HTML entity、隱形字元、台北日期時間 */

const INVISIBLE = /[​-‏⁠﻿]/g;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** 去隱形字元、entity、頭尾與連續空白 */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeEntities(value).replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

/** 頁面裡所有 JSON-LD（陣列攤平）；壞掉的區塊跳過 */
export function jsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.flatMap(([, body]) => {
    try {
      const data: unknown = JSON.parse(body);
      const list = Array.isArray(data) ? data : [data];
      return list.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    } catch {
      return [];
    }
  });
}

/** JSON-LD 裡 @type 是 Event 的區塊 */
export function jsonLdEvents(html: string): Record<string, unknown>[] {
  return jsonLdBlocks(html).filter((block) => block["@type"] === "Event");
}

export function ogImage(html: string): string | null {
  const tag = /<meta[^>]+property=["']og:image["'][^>]*>/i.exec(html)?.[0];
  const content = tag ? /content=["']([^"']+)["']/i.exec(tag)?.[1] : undefined;
  return content ? decodeEntities(content).trim() : null;
}

const TAIPEI_OFFSET_MS = 8 * 60 * 60_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const pad2 = (value: number) => String(value).padStart(2, "0");

/**
 * ISO 時間 → 台北日期與時間：有時區（Z、+08:00）就換算；沒時區當台北牆上時間。
 * 00:00 視為沒寫時間。
 */
export function taipeiDateTime(value: unknown): { date: string; time: string | null } | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = ISO.exec(trimmed);
  if (!match) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  let parts: number[];
  if (hasZone) {
    const millis = Date.parse(trimmed);
    if (!Number.isFinite(millis)) return null;
    const local = new Date(millis + TAIPEI_OFFSET_MS);
    parts = [local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes()];
  } else {
    parts = match.slice(1, 6).map(Number);
  }
  const [year, month, day, hour, minute] = parts;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    time: hour === 0 && minute === 0 ? null : `${pad2(hour)}:${pad2(minute)}`,
  };
}

/** 「2026/10/09 19:30」「2026/9/12」→ YYYY-MM-DD（＋時間）；不是真實日期回 null */
export function slashDateTime(value: string): { date: string; time: string | null } | null {
  const match = /(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  const time = match[4] === undefined ? null : `${pad2(Number(match[4]))}:${match[5]}`;
  return { date: `${year}-${pad2(month)}-${pad2(day)}`, time: time === "00:00" ? null : time };
}
