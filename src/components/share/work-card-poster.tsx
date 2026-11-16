"use client";

/** 文章頁來源作品卡的海報版：海報載入失敗（外部網址失效、被擋）退成字卡版，不留空框（Dex 10/14 回報） */

import { useImageFailed } from "@/components/ui/fallback-img";

interface WorkCardPosterProps {
  title: string;
  posterUrl: string;
  posterCredit?: string | null;
  metaLines: string[];
  /** 載入失敗時顯示：server 端先畫好的字卡版 */
  fallback: React.ReactNode;
}

export function WorkCardPoster({ title, posterUrl, posterCredit, metaLines, fallback }: WorkCardPosterProps) {
  const { failed, ref, onError } = useImageFailed(posterUrl);
  if (failed) return <>{fallback}</>;
  return (
    <figure className="relative mt-8 mr-[-16px] mb-0 ml-0 flex min-h-[300px] items-end gap-3.5">
      <div aria-hidden="true" className="share-blob absolute top-[34px] left-6 h-[210px] w-[190px] bg-ember-tint-2" />
      <figcaption className="relative flex min-w-0 flex-1 flex-col gap-1.5 pb-1">
        <span className="text-eyebrow tracking-[0.2em] text-ember-dark">圖 · 作品</span>
        <span className="font-serif-tc text-[18px] leading-[1.35] font-bold text-ink-950">{title}</span>
        {metaLines.map((line) => (
          <span key={line} className="text-caption leading-[1.7] text-ink-700">
            {line}
          </span>
        ))}
        <span className="my-1 block h-px w-6 bg-ink-400" />
        {posterCredit ? <span className="text-eyebrow text-ink-600">{posterCredit}</span> : null}
      </figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element -- 海報來自外部（TMDB），不經 next/image 最佳化 */}
      <img
        ref={ref}
        src={posterUrl}
        alt={`《${title}》海報`}
        onError={onError}
        className="relative h-[294px] w-[196px] flex-none object-cover"
      />
    </figure>
  );
}
