"use client";

/** 頁面轉場：每次換頁重新掛載，規則見 page-transition.ts */

import { usePathname } from "next/navigation";
import { transitionClass } from "@/components/app-shell/page-transition";

export default function SocialTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className={transitionClass(pathname)}>{children}</div>;
}
