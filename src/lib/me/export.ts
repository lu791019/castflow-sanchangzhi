/** 「匯出我的全部文章」：文章正文 + 當時說的原文（逐字稿），打包成一個 Markdown 檔（純函式） */

import { pad2, taipeiParts } from "@/lib/journal/time";

export interface ExportArticle {
  title: string;
  createdAt: string;
  publishedAt: string | null;
  visibility: string;
  workTitle: string | null;
  body: string;
  transcript: string | null;
}

const VISIBILITY_TEXT: Record<string, string> = {
  public: "公開",
  unlisted: "只給有連結的人",
  private: "私人",
};

function dateText(iso: string): string {
  const parts = taipeiParts(new Date(iso));
  return `${parts.year}.${pad2(parts.month)}.${pad2(parts.day)}`;
}

function statusText(article: ExportArticle): string {
  if (!article.publishedAt) return "草稿";
  return `${dateText(article.publishedAt)} 發佈・${VISIBILITY_TEXT[article.visibility] ?? "公開"}`;
}

function section(article: ExportArticle): string {
  const lines = [
    `## ${article.title}`,
    "",
    `- 說的時間：${dateText(article.createdAt)}`,
    `- 狀態：${statusText(article)}`,
    ...(article.workTitle ? [`- 作品：《${article.workTitle}》`] : []),
    "",
    article.body.trim(),
  ];
  if (article.transcript?.trim()) {
    lines.push("", "### 當時說的原文", "", article.transcript.trim());
  }
  return lines.join("\n");
}

export function buildExportMarkdown(penName: string, articles: readonly ExportArticle[], now: Date): string {
  const header = [`# ${penName} 的專欄・散場之後`, "", `匯出時間：${dateText(now.toISOString())}・共 ${articles.length} 篇`];
  return [header.join("\n"), ...articles.map(section)].join("\n\n---\n\n") + "\n";
}

export function exportFileName(now: Date): string {
  const parts = taipeiParts(now);
  return `castflow-${parts.year}${pad2(parts.month)}${pad2(parts.day)}.md`;
}

/** 設定頁說明：「12 篇文章與當時說的原文，打包成一個檔案」 */
export function exportCountLabel(count: number): string {
  return count > 0 ? `${count} 篇文章與當時說的原文，打包成一個檔案` : "還沒有文章；說過一段之後就能匯出";
}
