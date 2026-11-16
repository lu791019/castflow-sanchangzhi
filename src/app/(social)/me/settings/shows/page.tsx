import type { Metadata } from "next";
import { FormMeasure } from "@/components/app-shell/form-measure";
import { requirePageUserId } from "@/lib/auth/page";
import { toShowRow } from "@/lib/me/shows";
import { listMyShows } from "@/lib/me/shows-repository";
import { PageHeader } from "../settings-parts";
import { ShowsView } from "./shows-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的節目｜散場誌",
  robots: { index: false },
};

export default async function ShowsPage() {
  const userId = await requirePageUserId("/me/settings/shows");
  const shows = (await listMyShows(userId)).map(toShowRow);
  return (
    <FormMeasure>
      <PageHeader title="我的節目" backHref="/me/settings" backLabel="返回設定" />
      <ShowsView shows={shows} />
    </FormMeasure>
  );
}
