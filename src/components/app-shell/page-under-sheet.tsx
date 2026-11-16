"use client";

import { usePathname } from "next/navigation";
import { useLogSheet } from "@/components/journal/log-sheet-provider";

/**
 * 版心寬度（P4 斷點與排版規格）：頁面自帶 16px 內距，這裡只管外框。
 * - 手機 < 768：480 置中（主場）
 * - 平板 768：632 版心（＋頁內 16＝外框 664），左側讓出直欄 72
 * - 寬螢幕版型（Q-60）：目錄、散場之前在 ≥1024 不設外框，頁面自己用 1360 容器（深色帶要撐滿整個寬）
 * - 其餘頁（日誌、我的、索引…，Dex 10/15）≥1024 也是 1360 容器、對齊刊頭：外框左右 24＋頁面自帶的 16＝刊頭的 40
 */
const FULL_PAGES = new Set(["/", "/before"]);

const WIDE = "max-w-[480px] md:max-w-[664px] lg:max-w-[1440px] lg:px-6";
const FULL = "max-w-[480px] md:max-w-[664px] lg:max-w-none";

function frameClass(pathname: string): string {
  return FULL_PAGES.has(pathname) ? FULL : WIDE;
}

/** 記一筆 sheet 壓上來時縮 2%、圓角 4px，像底下那頁被壓低一點（P4 〇一a） */
export function PageUnderSheet({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { pressingPage } = useLogSheet();
  return (
    <div data-sheet-open={pressingPage} className={`p4-under-sheet mx-auto w-full ${frameClass(pathname)}`}>
      {children}
    </div>
  );
}
