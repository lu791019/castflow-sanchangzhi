"use client";

/**
 * 場刊「補封面」通過後直接換圖（API 回的 posterUrl），不等 router.refresh() 重讀（它只在背景同步；
 * 打包版偶爾套不上 refresh 的串流回應）。
 * 換上的圖依作品記在頁面層級（不放元件 state：背景 refresh 重掛元件時不會掉回字卡）。
 */

import { useSyncExternalStore } from "react";
import { createKeyedStore } from "@/lib/ui/keyed-store";
import { CoverImage } from "./cover-image";

const approvedPosters = createKeyedStore<string | null>(null);

/** 表單用：補封面通過後換上這張 */
export function showApprovedPoster(workId: string, url: string): void {
  approvedPosters.set(workId, url);
}

interface CoverSlotProps {
  workId: string;
  alt: string;
  /** 換成圖之後的尺寸（同 server 端有圖時的版型） */
  imageClassName: string;
  /** server 端畫好的封面（字卡或圖）；換圖載入失敗時也退回它 */
  children: React.ReactNode;
}

export function CoverSlot({ workId, alt, imageClassName, children }: CoverSlotProps) {
  const posterUrl = useSyncExternalStore(approvedPosters.subscribe, () => approvedPosters.get(workId), () => null);
  if (!posterUrl) return <>{children}</>;
  return <CoverImage url={posterUrl} alt={alt} className={imageClassName} fallback={children} eager />;
}
