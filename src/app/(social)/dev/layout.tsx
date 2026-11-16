import { notFound } from "next/navigation";

/** 開發用展示頁（/dev/nav、/dev/skeleton）：正式環境一律 404 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
