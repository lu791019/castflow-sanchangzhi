import type { Metadata } from "next";
import { PageSkeleton } from "@/components/app-shell/page-skeleton";

export const metadata: Metadata = {
  title: "換頁骨架｜散場誌",
};

const VARIANTS = ["article", "feature", "journal", "before"] as const;
type Variant = (typeof VARIANTS)[number];

/** 換頁骨架展示（開發用，不入主導航）：/dev/skeleton?v=article|feature|journal|before */
export default async function SkeletonPreviewPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const variant: Variant = VARIANTS.find((item) => item === v) ?? "article";
  return <PageSkeleton variant={variant} />;
}
