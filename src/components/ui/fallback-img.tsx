"use client";

/**
 * 外部圖片（TMDB／iTunes／讀者貼的網址）載入失敗就退回該處原本的無圖樣式，不留破圖或空框。
 * server 先渲染的 <img> 可能在 hydrate 前就失敗（onError 已錯過），掛上時再看一次 complete＋naturalWidth。
 */

import { useCallback, useState } from "react";

interface ImageFailure {
  failed: boolean;
  ref: (img: HTMLImageElement | null) => void;
  onError: () => void;
}

export function useImageFailed(url: string | null | undefined): ImageFailure {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const markFailed = useCallback(() => {
    if (url) setFailedUrl(url);
  }, [url]);
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth === 0) markFailed();
    },
    [markFailed],
  );
  return { failed: !url || failedUrl === url, ref, onError: markFailed };
}

type FallbackImgProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  src: string | null | undefined;
  /** 沒網址或載入失敗時顯示（該處原本的無圖樣式；null＝整個不顯示） */
  fallback: React.ReactNode;
};

export function FallbackImg({ src, fallback, alt = "", ...rest }: FallbackImgProps) {
  const { failed, ref, onError } = useImageFailed(src);
  if (failed || !src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- 圖片來自外部，不經 next/image 最佳化
  return <img {...rest} ref={ref} src={src} alt={alt} onError={onError} />;
}
