import { notFound } from "next/navigation";
import { findWorkBySlug } from "@/lib/works/repository";

/** 換頁骨架（loading.tsx）一開始串流，狀態碼就固定 200：沒有這部作品要在這裡、骨架之前就回 404 */
export default async function WorkSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await findWorkBySlug(slug))) notFound();
  return children;
}
