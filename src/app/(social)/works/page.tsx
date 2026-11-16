import type { Metadata } from "next";
import Link from "next/link";
import { formatIssueNo, KIND_LABELS } from "@/lib/works/format";
import { listWorks, type WorkIndexItem } from "@/lib/works/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "作品｜散場誌",
};

function WorkIndexRow({ item }: { item: WorkIndexItem }) {
  return (
    <Link
      href={`/works/${item.slug}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-ink-200 py-4 text-inherit no-underline"
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-eyebrow font-bold tracking-[0.3em] text-ember-dark">
          {formatIssueNo(item.issueNo)}
        </span>
        <span className="font-serif-tc text-prose leading-[1.45] font-bold break-words text-ink-950">
          {item.title}
        </span>
        {item.podcastShow ? (
          <span className="text-caption text-ink-600">《{item.podcastShow}》</span>
        ) : null}
      </span>
      <span className="text-caption tracking-[0.14em] text-ink-600">
        {KIND_LABELS[item.kind]}
      </span>
    </Link>
  );
}

/** 作品頁：雜誌式首頁（佔位）+ 已建立作品的簡單索引 */
export default async function WorksPage() {
  const works = await listWorks();
  return (
    <>
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950 lg:hidden">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">
          散場誌
        </span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">
          作品索引
        </span>
      </header>

      <div className="px-4 pb-[120px]">
        <section className="pt-6">
          <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">
            作品
          </span>
          <h1 className="mt-2.5 mb-0 font-serif-tc text-headline leading-[1.38] font-bold text-ink-950">
            每一部作品，
            <br />
            都有自己的一頁
          </h1>
          <p className="mt-2.5 mb-0 text-caption tracking-[0.06em] text-ink-600">
            同一部電影、同一集節目，散場後的感受集中在一起
          </p>
        </section>

        <div className="mt-6 flex items-baseline justify-between border-b border-ink-950 pb-2.5">
          <h2 className="m-0 font-serif-tc text-[19px] font-bold text-ink-950">
            作品索引
          </h2>
          <span className="text-eyebrow tracking-[0.14em] text-ink-600">
            {works.length > 0 ? `共 ${works.length} 期` : "即將開放"}
          </span>
        </div>

        {works.length > 0 ? (
          <nav aria-label="作品特輯索引" className="flex flex-col">
            {works.map((item) => (
              <WorkIndexRow key={item.slug} item={item} />
            ))}
          </nav>
        ) : (
          <>
            <div aria-hidden="true" className="flex flex-col border-b border-ink-200 py-[18px]">
              <div className="h-px w-[30%] bg-ink-300" />
              <div className="mt-4 h-px w-full bg-ink-50" />
              <div className="mt-2 h-px w-[82%] bg-ink-50" />
            </div>
            <div aria-hidden="true" className="flex flex-col border-b border-ink-200 py-[18px]">
              <div className="h-px w-[24%] bg-ink-300" />
              <div className="mt-4 h-px w-[70%] bg-ink-50" />
            </div>
          </>
        )}

        <p className="mt-4 mb-0 text-note leading-[1.8] text-ink-600">
          之後，你可以從這裡走進任何一部作品，看看散場之後大家留下了什麼。
        </p>
      </div>
    </>
  );
}
