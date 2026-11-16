import type { Metadata } from "next";
import { withdrawnMetadata } from "@/lib/share/share-metadata";
import { Withdrawn } from "./[slug]/withdrawn";

export const metadata: Metadata = withdrawnMetadata();

/** 完全找不到這個分享連結：同一張「已收回」頁，但沒有期號可劃（放在 /s 層：[slug]/layout 的 notFound 也接得到） */
export default function ShareNotFound() {
  return <Withdrawn issueNo={null} />;
}
