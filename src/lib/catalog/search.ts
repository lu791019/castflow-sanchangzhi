/** 索引搜尋的純邏輯：查詢正規化、ilike 跳脫、命中字切段、文章句子摘錄 */

import { parseArticle } from "@/lib/share/article";

export const MAX_QUERY_LENGTH = 40;
const SNIPPET_MAX = 60;

export function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

/** ilike 用：跳脫 \ % _，拿掉 PostgREST 會當萬用字元的 * */
export function likePattern(query: string): string {
  const escaped = query.replace(/\*/g, "").replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

export function includesQuery(text: string, query: string): boolean {
  if (!query) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** 把命中字切出來（不分大小寫，保留原字） */
export function highlight(text: string, query: string): HighlightPart[] {
  if (!query) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: HighlightPart[] = [];
  let cursor = 0;
  let index = lower.indexOf(needle, cursor);
  while (index !== -1) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

function bodySentences(body: string): string[] {
  const { blocks } = parseArticle(body);
  return blocks
    .flatMap((block) => (block.type === "list" ? block.items : [block.text]))
    .flatMap((text) => text.match(/[^。！？!?]+[。！？!?」』]*/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** 正文裡含命中字的那一句；太長以命中處為中心截斷 */
export function snippetAround(body: string, query: string, max = SNIPPET_MAX): string | null {
  if (!query) return null;
  const sentence = bodySentences(body).find((candidate) => includesQuery(candidate, query));
  if (!sentence) return null;
  if (sentence.length <= max) return sentence;
  const at = sentence.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, Math.min(at - Math.floor((max - query.length) / 2), sentence.length - max));
  const end = start + max;
  return `${start > 0 ? "…" : ""}${sentence.slice(start, end)}${end < sentence.length ? "…" : ""}`;
}
