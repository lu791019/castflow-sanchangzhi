import type { Metadata } from "next";
import { FormMeasure } from "@/components/app-shell/form-measure";
import { requirePageUserId } from "@/lib/auth/page";
import { PageHeader } from "../settings/settings-parts";
import { ImportStage } from "./import-stage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "搬進舊文章｜散場誌",
  robots: { index: false },
};

/** 我的 › 搬進舊文章：貼部落格文章網址，確認作品後以筆名發佈（proxy 已擋未登入與沒筆名） */
export default async function ImportPage() {
  await requirePageUserId("/me/import");
  return (
    <FormMeasure>
      <PageHeader title="搬進舊文章" backHref="/me" backLabel="返回我的" />
      <div className="px-4 pb-[120px]">
        <p className="mt-6 mb-0 font-serif-tc text-lede leading-[1.9] text-ink-800">
          在別的地方寫過的觀影、聽完的感受，貼上文章網址，就能搬進你的專欄。
        </p>
        <ImportStage />
      </div>
    </FormMeasure>
  );
}
