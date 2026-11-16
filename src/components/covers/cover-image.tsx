"use client";

/** 封面圖：載入失敗（外部網址失效、被擋）就換成字卡，不留空格子 */

import { FallbackImg } from "@/components/ui/fallback-img";

interface CoverImageProps {
  url: string;
  alt: string;
  className: string;
  /** 載入失敗時顯示（server 端先畫好的字卡） */
  fallback: React.ReactNode;
  eager?: boolean;
}

export function CoverImage({ url, alt, className, fallback, eager = false }: CoverImageProps) {
  return (
    <FallbackImg
      src={url}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fallback={fallback}
      className={`block flex-none bg-paper-2 object-cover ${className}`}
    />
  );
}
