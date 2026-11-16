/**
 * Readability 抽出的正文 HTML → 文章段落（ArticleBlock，與文章頁同一套型別）→ Markdown。
 * 只保留段落、小標、清單；圖片、影片、表單、程式碼框外的雜物一律丟掉。
 * <br> 視為分段（台灣部落格常用 <br> 斷段）；原始碼裡的換行只是空白。
 */

import { parseHTML } from "linkedom";
import type { ArticleBlock } from "@/lib/share/article";

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const LISTS = new Set(["ul", "ol"]);
const SKIP = new Set(["script", "style", "noscript", "img", "picture", "video", "audio", "iframe", "svg", "figcaption", "form", "button", "input", "select", "textarea", "nav", "aside", "footer"]);
const BLOCKS = new Set(["p", "div", "section", "article", "main", "blockquote", "figure", "pre", "header", "table", "tbody", "tr", "td", "dl", "dd", "dt", ...HEADINGS, ...LISTS, "li"]);

const CJK = "\\p{Script=Han}\\p{Script=Bopomofo}，。！？、；：「」『』（）《》〈〉…—";
const CJK_GAP = new RegExp(`([${CJK}])\\s+(?=[${CJK}])`, "gu");

type DomNode = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<DomNode> };

const ELEMENT = 1;
const TEXT = 3;

function tagOf(node: DomNode): string {
  return node.nodeName.toLowerCase();
}

/** 文字：原始碼空白收成一格、<br> 變換行；略過不要的元素 */
function rawText(node: DomNode): string {
  if (node.nodeType === TEXT) return (node.textContent ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== ELEMENT) return "";
  const tag = tagOf(node);
  if (tag === "br") return "\n";
  if (SKIP.has(tag)) return "";
  const inner = Array.from(node.childNodes).map(rawText).join("");
  return BLOCKS.has(tag) ? `\n${inner}\n` : inner;
}

function cleanLine(line: string): string {
  return line.replace(/[ \t 　]+/g, " ").replace(CJK_GAP, "$1").trim();
}

function lines(text: string): string[] {
  return text.split("\n").map(cleanLine).filter(Boolean);
}

function hasBlockChild(node: DomNode): boolean {
  return Array.from(node.childNodes).some((child) => child.nodeType === ELEMENT && (BLOCKS.has(tagOf(child)) || hasBlockChild(child)));
}

function listItems(node: DomNode): string[] {
  return Array.from(node.childNodes)
    .filter((child) => child.nodeType === ELEMENT && tagOf(child) === "li")
    .map((child) => lines(rawText(child)).join(" "))
    .filter(Boolean);
}

function paragraphs(text: string): ArticleBlock[] {
  return lines(text).map((line) => ({ type: "paragraph", text: line }));
}

function blocksOf(node: DomNode): ArticleBlock[] {
  const out: ArticleBlock[] = [];
  let inline = "";
  const flush = () => {
    out.push(...paragraphs(inline));
    inline = "";
  };
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== ELEMENT) {
      inline += rawText(child);
      continue;
    }
    const tag = tagOf(child);
    if (SKIP.has(tag)) continue;
    if (!BLOCKS.has(tag)) {
      inline += rawText(child);
      continue;
    }
    flush();
    if (HEADINGS.has(tag)) {
      const text = lines(rawText(child)).join(" ");
      if (text) out.push({ type: "heading", text });
    } else if (LISTS.has(tag)) {
      const items = listItems(child);
      if (items.length > 0) out.push({ type: "list", items });
    } else if (tag === "p" || tag === "pre" || !hasBlockChild(child)) {
      out.push(...paragraphs(rawText(child)));
    } else {
      out.push(...blocksOf(child));
    }
  }
  flush();
  return out;
}

export function htmlToBlocks(contentHtml: string): ArticleBlock[] {
  const { document } = parseHTML(`<!doctype html><html><body>${contentHtml}</body></html>`);
  return blocksOf(document.body as unknown as DomNode);
}

/** 行首若長得像 Markdown 語法（#、- 、* ），前面墊零寬空白，避免文章頁誤判成標題或清單 */
function escapeLine(text: string): string {
  return /^(#|[-*]\s)/.test(text) ? `​${text}` : text;
}

export function articleMarkdown(title: string, blocks: readonly ArticleBlock[]): string {
  const body = blocks.map((block) => {
    if (block.type === "heading") return `## ${block.text}`;
    if (block.type === "list") return block.items.map((item) => `- ${item}`).join("\n");
    return escapeLine(block.text);
  });
  return [`# ${title}`, ...body].join("\n\n");
}

/** 正文純文字字數（不含標題） */
export function blocksTextLength(blocks: readonly ArticleBlock[]): number {
  return blocks.reduce((total, block) => total + (block.type === "list" ? block.items.join("").length : block.text.length), 0);
}
