import { PageSkeleton } from "@/components/app-shell/page-skeleton";

/** 文章頁換頁骨架（UX-08）：文章頁不在社交殼裡，自己鋪紙色底 */
export default function ArticleLoading() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-paper font-sans-tc text-ink-900">
      <PageSkeleton variant="article" />
    </div>
  );
}
