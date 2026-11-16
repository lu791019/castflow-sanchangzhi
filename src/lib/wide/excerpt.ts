/** 寬版目錄「封面故事」的內文開頭：跳過導言，取前兩段、總長不超過上限（超過加刪節號） */

import { deriveLede, parseArticle } from "@/lib/share/article";

export const EXCERPT_MAX_CHARS = 180;
const EXCERPT_PARAGRAPHS = 2;

export function leadExcerpt(blogBody: string, maxChars: number = EXCERPT_MAX_CHARS): string[] {
  const { blocks } = deriveLede(parseArticle(blogBody).blocks);
  const paragraphs = blocks.flatMap((block) => (block.type === "paragraph" ? [block.text] : []));
  return paragraphs.slice(0, EXCERPT_PARAGRAPHS).reduce<{ out: string[]; left: number }>(
    ({ out, left }, text) => {
      if (left <= 0) return { out, left };
      const chars = Array.from(text);
      if (chars.length <= left) return { out: [...out, text], left: left - chars.length };
      return { out: [...out, `${chars.slice(0, left).join("")}…`], left: 0 };
    },
    { out: [], left: maxChars },
  ).out;
}
