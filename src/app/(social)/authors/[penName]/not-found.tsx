import Link from "next/link";

/** 筆名不存在或沒有公開文章：同一張頁面，不透露帳號是否存在 */
export default function AuthorNotFound() {
  return (
    <div className="px-4 pt-16 pb-[120px] md:mx-auto md:max-w-[632px] lg:mx-0 lg:max-w-none">
      <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">專欄</span>
      <h1 className="mt-2.5 mb-0 font-serif-tc text-quote leading-[1.6] font-semibold text-ink-950">這裡還沒有專欄。</h1>
      <p className="mt-2.5 mb-0 text-note leading-[1.8] text-ink-700">可能還沒有公開發表，或筆名換過了。</p>
      <Link href="/catalog?tab=authors" className="mt-3 inline-flex min-h-11 items-center text-note font-bold text-ember-dark no-underline">
        回索引看作者 →
      </Link>
    </div>
  );
}
