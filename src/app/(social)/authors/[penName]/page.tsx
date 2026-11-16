import { authorPath } from "@/lib/authors/path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { communityEnabled } from "@/lib/features";
import { cache } from "react";
import { ArticleRows } from "@/components/catalog/article-rows";
import { PenSeal } from "@/components/seal/pen-seal";
import { authorMeta } from "@/lib/catalog/authors";
import { loadAuthorColumn } from "@/lib/catalog/repository";
import { articleRows } from "@/lib/catalog/view";
import { columnLabel } from "@/lib/me/column-name";

export const dynamic = "force-dynamic";

const PEN_NAME_MAX = 20;

/** 網址段 → 筆名；解不開或超過筆名長度上限直接當不存在 */
function decodePenName(raw: string): string | null {
  try {
    const value = decodeURIComponent(raw).trim();
    return value && Array.from(value).length <= PEN_NAME_MAX ? value : null;
  } catch {
    return null;
  }
}

/** 同一次請求 metadata 與頁面共用一次查詢 */
const loadColumn = cache(async (raw: string) => {
  const penName = decodePenName(raw);
  return penName ? loadAuthorColumn(penName) : null;
});

export async function generateMetadata({ params }: { params: Promise<{ penName: string }> }): Promise<Metadata> {
  if (!communityEnabled()) return {};
  const { penName } = await params;
  const column = await loadColumn(penName).catch(() => null);
  if (!column) return { title: "找不到這個專欄｜散場誌" };
  return { title: `${column.penName}的專欄｜散場誌`, description: `${column.penName}在散場之後寫下的感受。`, alternates: { canonical: authorPath(penName) } };
}

/**
 * 作者專欄頁（P3）：印章 64＋筆名＋公開發佈、筆名署名的文章（雜誌目錄語彙）。
 * 眉標同「我的・專欄作者頁」：取了專欄名是「專欄｜公車上的散場」，沒取只寫「專欄」。
 * 不顯示粉絲、追蹤、統計排名；沒有公開文章的筆名 404。
 */
export default async function AuthorColumnPage({ params }: { params: Promise<{ penName: string }> }) {
  if (!communityEnabled()) notFound();
  const { penName } = await params;
  const column = await loadColumn(penName);
  if (!column) notFound();

  const rows = await articleRows(column, column.articles);
  const latest = column.articles[0]?.publishedAt ?? "";

  return (
    <>
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950 lg:hidden">
        <Link href="/" className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950 no-underline">
          散場誌
        </Link>
        <Link href="/catalog?tab=authors" className="flex min-h-11 items-center text-eyebrow tracking-[0.14em] text-ink-600 no-underline">
          索引・作者
        </Link>
      </header>

      <div className="px-4 pb-[120px] md:mx-auto md:max-w-[632px] lg:mx-0 lg:max-w-none lg:pb-16">
        <section className="grid grid-cols-[minmax(0,1fr)_64px] items-start gap-x-4 pt-7">
          <div className="flex min-w-0 flex-col gap-2">
            <span data-testid="author-column-label" className="text-caption font-bold tracking-[0.2em] break-words text-ember-dark">
              {columnLabel(column.columnName) ?? "專欄"}
            </span>
            <h1 className="m-0 font-serif-tc text-headline leading-[1.3] font-bold break-words text-ink-950">{column.penName}</h1>
            <span className="text-caption text-ink-700 tabular-nums">{authorMeta(column.articles.length, latest)}</span>
          </div>
          <PenSeal penName={column.penName} size={64} />
        </section>

        <section className="mt-7" aria-labelledby="author-articles">
          <div className="flex items-baseline justify-between border-b border-ink-950 pb-2.5">
            <h2 id="author-articles" className="m-0 font-serif-tc text-section font-bold text-ink-950">
              發表過的感受
            </h2>
            <span className="text-eyebrow tracking-[0.14em] text-ink-600">由新到舊</span>
          </div>
          <ArticleRows rows={rows} showAuthor={false} />
        </section>
      </div>
    </>
  );
}
