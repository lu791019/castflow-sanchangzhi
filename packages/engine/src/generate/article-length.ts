/**
 * Blog 文章字數上限：「說一分鐘就好」，整理出來的文章不該被擴寫成長文。
 * 600 這個數字只在這裡定義；prompt、重試提示、警報都引用它。
 */

export const BLOG_MAX_CHARS = 600;
export const BLOG_MIN_PARAGRAPHS = 3;
export const BLOG_MAX_PARAGRAPHS = 6;

const HAN_PATTERN = /\p{Script=Han}/gu;

/** 繁體中文字數：只計漢字（不算標點、空白、Markdown 符號與英數） */
export function countChineseChars(text: string): number {
  return text.match(HAN_PATTERN)?.length ?? 0;
}

export function isOverBlogLimit(text: string, limit: number = BLOG_MAX_CHARS): boolean {
  return countChineseChars(text) > limit;
}

/** 超過上限時的重試提示（帶實際字數） */
export function buildShortenPrompt(
  basePrompt: string,
  previous: string,
  limit: number = BLOG_MAX_CHARS,
): string {
  const count = countChineseChars(previous);
  return `${basePrompt}

## 上一版超過字數上限
上一版 Blog 文章有 ${count} 字，超過 ${limit} 字上限，請縮短。
- 全文 ${limit} 字以內（繁體中文字數），段落 ${BLOG_MIN_PARAGRAPHS}–${BLOG_MAX_PARAGRAPHS} 段
- 只能刪減與精煉，不得新增原話沒有的情節或細節

## 上一版（請以此為底縮短）
${previous}

請直接輸出縮短後的 Blog 文章，不要加 JSON 包裝或其他說明文字。`;
}
