import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArticleRows } from "@/components/catalog/article-rows";
import { AuthorRows } from "@/components/catalog/author-rows";
import { ColumnCovers } from "@/components/catalog/column-covers";
import { MastheadSwitch } from "@/components/catalog/masthead-switch";
import { NoResults } from "@/components/catalog/no-results";
import { CatalogSearchBox } from "@/components/catalog/search-box";
import { SearchResultList } from "@/components/catalog/search-results";
import { WorkShelves } from "@/components/catalog/work-shelves";
import { CATALOG_COLUMNS, parseColumnKey, type ColumnKey } from "@/lib/catalog/columns";
import { loadCatalogData, type CatalogData } from "@/lib/catalog/repository";
import { normalizeQuery } from "@/lib/catalog/search";
import { CATALOG_TABS, parseCatalogTab, parseShelfKind, type CatalogTab } from "@/lib/catalog/tabs";
import { communityEnabled } from "@/lib/features";
import { allowCatalogSearch } from "@/lib/rate-limit/catalog-search";
import { clientIp } from "@/lib/rate-limit/token-bucket";
import {
  articleRows,
  catalogAuthors,
  catalogColumnCovers,
  catalogHero,
  catalogSearch,
  catalogShelves,
  catalogTries,
  columnArticles,
} from "@/lib/catalog/view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "索引｜散場誌",
  description: "依類型、作者與欄目排列。不排名，只照最近的時間。",
};

const AUTHOR_PREVIEW = 20;

type SearchParams = Record<string, string | string[] | undefined>;

async function loadData(): Promise<CatalogData | null> {
  try {
    return await loadCatalogData();
  } catch (error) {
    console.error("[catalog] load failed", { message: error instanceof Error ? error.message : error });
    return null;
  }
}

function Tabs({ tab }: { tab: CatalogTab }) {
  return (
    <nav aria-label="索引分類" className="mx-4 mt-2 flex gap-[26px] border-b border-ink-200">
      {CATALOG_TABS.map((item) => (
        <Link
          key={item.tab}
          href={item.href}
          aria-current={tab === item.tab ? "page" : undefined}
          className={`hit-44 flex min-h-11 items-center font-serif-tc text-prose no-underline ${
            tab === item.tab ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

async function ColumnDetail({ data, columnKey }: { data: CatalogData; columnKey: ColumnKey }) {
  const column = CATALOG_COLUMNS.find((item) => item.key === columnKey)!;
  const articles = columnArticles(data, columnKey);
  const rows = await articleRows(data, articles);
  return (
    <section className="px-4 pt-5" aria-labelledby="column-title">
      <Link href="/catalog?tab=columns" className="inline-flex min-h-11 items-center text-caption text-ink-700 no-underline">
        ‹ 全部欄目
      </Link>
      <div className="flex items-baseline justify-between border-b border-ink-950 pb-2.5">
        <h2 id="column-title" className="m-0 font-serif-tc text-section font-bold text-ink-950">
          {column.name}
        </h2>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">{articles.length} 篇・由新到舊</span>
      </div>
      <p className="mt-2 mb-0 text-note leading-[1.7] text-ink-700">{column.description}</p>
      {rows.length > 0 ? (
        <ArticleRows rows={rows} showAuthor />
      ) : (
        <p className="mt-5 mb-0 text-note leading-[1.8] text-ink-600">這個欄目還沒有文章。</p>
      )}
    </section>
  );
}

async function TabBody({ data, tab, params }: { data: CatalogData; tab: CatalogTab; params: SearchParams }) {
  if (tab === "authors") {
    const rows = catalogAuthors(data);
    const showAll = params.all === "1";
    return <AuthorRows rows={showAll ? rows : rows.slice(0, AUTHOR_PREVIEW)} total={rows.length} showAll={showAll} />;
  }
  if (tab === "columns") {
    const columnKey = parseColumnKey(typeof params.column === "string" ? params.column : undefined);
    if (columnKey) return <ColumnDetail data={data} columnKey={columnKey} />;
    return <ColumnCovers data={await catalogColumnCovers(data)} />;
  }
  const kind = parseShelfKind(params.kind);
  return <WorkShelves shelves={catalogShelves(data, kind)} fullKind={kind} />;
}

async function SearchBody({ data, query }: { data: CatalogData; query: string }) {
  if (!allowCatalogSearch(clientIp(await headers()))) {
    return (
      <p role="alert" className="m-0 px-4 pt-6 text-note leading-[1.8] text-ink-700">
        查得太快了，稍等一下再試。
      </p>
    );
  }
  let results;
  try {
    results = await catalogSearch(data, query, new Date());
  } catch (error) {
    console.error("[catalog] search failed", { message: error instanceof Error ? error.message : error });
    return (
      <p role="alert" className="m-0 px-4 pt-6 text-note leading-[1.8] text-ink-700">
        搜尋暫時沒有回應，稍後再試一次。
      </p>
    );
  }
  const total = results.works.length + results.authors.length + results.articles.length;
  if (total === 0) return <NoResults query={query} tries={catalogTries(data, query)} />;
  return <SearchResultList results={results} query={query} />;
}

/** 索引（設計稿「P3 索引 A–E」）：搜尋列＋作品／作者／欄目；搜尋時換成混合結果 */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!communityEnabled()) notFound();
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const tab = parseCatalogTab(params.tab);
  const data = await loadData();
  const hero = data ? catalogHero(data) : null;

  return (
    <>
      <header className="mx-4 flex h-[52px] items-stretch justify-between border-b border-ink-950 lg:hidden">
        <Link href="/" className="hit-44 self-center font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950 no-underline">
          散場誌
        </Link>
        <MastheadSwitch current="catalog" />
      </header>

      <div className="pb-[120px] md:mx-auto md:max-w-[632px] lg:mx-0 lg:max-w-none lg:pb-16">
        {!query ? (
          <section className="px-4 pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">總目錄</span>
              <span className="text-eyebrow tracking-[0.08em] text-ink-600 tabular-nums">{hero?.meta}</span>
            </div>
            <h1 className="mt-2.5 mb-0 font-serif-tc text-headline leading-[1.38] font-bold text-ink-950">
              {hero?.lines[0] ?? "索引"}
              <br />
              {hero?.lines[1]}
            </h1>
            <p className="mt-2 mb-0 text-caption tracking-[0.04em] text-ink-600">依類型、作者與欄目排列。不排名，只照最近的時間。</p>
          </section>
        ) : (
          <h1 className="sr-only">搜尋「{query}」</h1>
        )}

        <CatalogSearchBox initialQuery={query} tab={tab} />

        {!data ? (
          <p role="alert" className="m-0 px-4 pt-6 text-note leading-[1.8] text-ink-700">
            索引暫時讀不到，稍後再試一次。
          </p>
        ) : query ? (
          <SearchBody data={data} query={query} />
        ) : (
          <>
            <Tabs tab={tab} />
            <TabBody data={data} tab={tab} params={params} />
          </>
        )}
      </div>
    </>
  );
}
