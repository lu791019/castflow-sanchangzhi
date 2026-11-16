/**
 * 封面補齊 E2E 用的測試資料：service role 直接寫本地 Supabase。
 * - 封面圖：程式產生的小 PNG，上傳到 `covers` 桶（結束時刪）
 * - 場外／電影作品：直接建 works 列（呼叫端 trackWork，結束時刪）
 */

import { deflateSync } from "node:zlib";
import { serviceRoleKey, supabaseUrl } from "./env";

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceRoleKey();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** 單色直式 PNG（上半一色、下半另一色，截圖看得出是圖） */
export function makePng(width: number, height: number, top: [number, number, number], bottom: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Array.from({ length: height }, (_, y) => {
    const [r, g, b] = y < height / 2 ? top : bottom;
    return Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function coverPublicUrl(path: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/covers/${path}`;
}

export async function uploadCoverObject(path: string, png: Buffer): Promise<string> {
  const response = await fetch(`${supabaseUrl()}/storage/v1/object/covers/${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "image/png", "x-upsert": "true" }),
    body: new Uint8Array(png),
  });
  if (!response.ok) throw new Error(`[covers seed] upload ${path} → ${response.status} ${(await response.text()).slice(0, 300)}`);
  return coverPublicUrl(path);
}

/** 刪掉單一封面（以公開網址指定，例如測試中上傳拿到的） */
export async function removeCoverByUrl(url: string): Promise<void> {
  const prefix = coverPublicUrl("");
  if (!url.startsWith(prefix)) return;
  const removed = await fetch(`${supabaseUrl()}/storage/v1/object/covers`, {
    method: "DELETE",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [url.slice(prefix.length)] }),
  });
  if (!removed.ok) throw new Error(`[covers seed] remove ${url} → ${removed.status}`);
}

/** 刪掉 covers 桶裡某個資料夾（測試自己種的 e2e/） */
export async function removeCoverObjects(prefix: string): Promise<void> {
  const list = await fetch(`${supabaseUrl()}/storage/v1/object/list/covers`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix, limit: 100 }),
  });
  if (!list.ok) throw new Error(`[covers seed] list ${prefix} → ${list.status}`);
  const names = ((await list.json()) as Array<{ name: string }>).map((item) => `${prefix}/${item.name}`);
  if (names.length === 0) return;
  const removed = await fetch(`${supabaseUrl()}/storage/v1/object/covers`, {
    method: "DELETE",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: names }),
  });
  if (!removed.ok) throw new Error(`[covers seed] remove ${prefix} → ${removed.status}`);
}

export interface CoverWorkSeed {
  kind: "movie" | "series" | "podcast_episode" | "live" | "exhibition";
  title: string;
  venue?: string;
  eventDate?: string;
  eventEndDate?: string;
  posterUrl?: string | null;
  podcastShow?: string;
}

export async function createCoverWork(seed: CoverWorkSeed): Promise<{ id: string; slug: string }> {
  const slug = `e2e-covers-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const response = await fetch(`${supabaseUrl()}/rest/v1/works`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({
      kind: seed.kind,
      title: seed.title,
      slug,
      venue: seed.venue ?? null,
      event_date: seed.eventDate ?? null,
      event_end_date: seed.eventEndDate ?? null,
      poster_url: seed.posterUrl ?? null,
      podcast_show: seed.podcastShow ?? null,
    }),
  });
  if (!response.ok) throw new Error(`[covers seed] insert works → ${response.status} ${(await response.text()).slice(0, 300)}`);
  const [row] = (await response.json()) as Array<{ id: string; slug: string }>;
  return row;
}
