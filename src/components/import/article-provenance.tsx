/**
 * 文章頁正文下的出處說明（server）：匯入的文章寫「原文刊於〈網域〉」連回原文；
 * 其他文章維持「作者口述、AI 整理」。rel=canonical 指回原文是 Dex 待決事項，先不加。
 */

import { loadOriginalUrl } from "@/lib/import/original-url";
import { displayDomain } from "@/lib/import/url";

const NOTE = "mt-5 mb-0 text-caption leading-[1.7] text-ink-600";

export async function ArticleProvenance({ episodeId }: { episodeId: string }) {
  const url = await loadOriginalUrl(episodeId);
  const domain = url ? displayDomain(url) : null;
  if (!url || !domain) return <p className={NOTE}>本文由作者口述、AI 整理，經作者確認後發佈。</p>;
  return (
    <p className={NOTE}>
      原文刊於
      <a href={url} target="_blank" rel="noopener" className="text-ink-700 underline decoration-ink-300 underline-offset-4">
        〈{domain}〉
      </a>
    </p>
  );
}
