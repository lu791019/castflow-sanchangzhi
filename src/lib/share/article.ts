/** 分享頁正文處理：輕量 Markdown 解析 + pull quote / 作品名 / 副標抽取 */

export type ArticleBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export interface ParsedArticle {
  title: string | null;
  blocks: ArticleBlock[];
}

export const PULL_QUOTE_MIN = 20;
export const PULL_QUOTE_MAX = 60;
const LEDE_MIN = 20;
const LEDE_MAX = 90;

/** 去掉行內 Markdown 標記（粗體、斜體、行內碼、連結），保留文字 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
}

/**
 * 解析生成的 blog 正文：
 * - 開頭的 `# 標題` 抽成 title（頁面 h1 另有來源，避免重複標題）
 * - `##`/`###` → heading、`-`/`*` 連續行 → list、其餘以空行分段
 */
export function parseArticle(body: string): ParsedArticle {
  const lines = body.split(/\r?\n/);
  const blocks: ArticleBlock[] = [];
  let title: string | null = null;
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = stripInlineMarkdown(paragraph.join(""));
    if (text) blocks.push({ type: "paragraph", text });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s*(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const text = stripInlineMarkdown(headingMatch[2]);
      if (headingMatch[1] === "#" && title === null && blocks.length === 0) {
        title = text;
      } else {
        blocks.push({ type: "heading", text });
      }
      continue;
    }
    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      list.push(stripInlineMarkdown(listMatch[1]));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  return { title, blocks };
}

/** 取正文第一句長度 20–60 字的句子當 pull quote；抽不到回傳 null */
export function extractPullQuote(blocks: ArticleBlock[]): string | null {
  for (const block of blocks) {
    if (block.type !== "paragraph") continue;
    const sentences = block.text.split(/(?<=[。！？!?])/);
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (
        sentence.length >= PULL_QUOTE_MIN &&
        sentence.length <= PULL_QUOTE_MAX
      ) {
        return sentence;
      }
    }
  }
  return null;
}

/** 從標題/正文抽第一個《…》作品名；抽不到回傳 null */
export function extractWorkTitle(
  ...texts: Array<string | null | undefined>
): string | null {
  for (const text of texts) {
    const match = text?.match(/《([^《》]{1,30})》/);
    if (match) return match[1];
  }
  return null;
}

/** 首段夠短（20–90 字）時抽成副標，正文不重複該段 */
export function deriveLede(blocks: ArticleBlock[]): {
  lede: string | null;
  blocks: ArticleBlock[];
} {
  const [first, ...rest] = blocks;
  if (
    first?.type === "paragraph" &&
    first.text.length >= LEDE_MIN &&
    first.text.length <= LEDE_MAX &&
    rest.some((block) => block.type === "paragraph")
  ) {
    return { lede: first.text, blocks: rest };
  }
  return { lede: null, blocks };
}

/** pull quote 插入點：第 min(3, 段落中點) 個 block 之後 */
export function pullQuotePosition(blocks: ArticleBlock[]): number {
  return Math.min(3, Math.max(1, Math.floor(blocks.length / 2)));
}

/** 期數風格編號：由 id 前 4 碼 hex 決定，穩定落在 1000–9999 */
export function issueNumber(id: string): string {
  const hex = id.replace(/-/g, "").slice(0, 4);
  const value = Number.parseInt(hex, 16);
  const issue = (Number.isNaN(value) ? 0 : value) % 9000;
  return String(issue + 1000);
}

export function formatDotDate(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
}

export function formatIssueMonth(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}.${month}`;
}
