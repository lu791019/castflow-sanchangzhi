import { notFound } from "next/navigation";
import { findWithdrawnIssue } from "./withdrawn-issue";

/**
 * 換頁骨架（loading.tsx）一開始串流，狀態碼就固定 200：找不到的分享連結要在這裡、骨架之前就回 404。
 * 只查 slug 對不對得到集數（已收回的仍交給頁面畫「已收回」）；頁面本身的檢查照舊。
 */
export default async function ShareSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await findWithdrawnIssue(slug))) notFound();
  return children;
}
