/** 分享頁 metadata：og／twitter 欄位（圖片由 opengraph-image / twitter-image 檔案慣例自動帶上） */

import type { Metadata } from "next";

export const SITE_NAME = "散場誌";
const WITHDRAWN_TITLE = "這一篇已經收回了";
/** 收回時的描述：不帶文章內容，用分享頁頁尾標語（蓋掉 layout 的英文預設描述） */
export const NEUTRAL_DESCRIPTION = "真實的感受，比完美的評價更值得被聽見";

/** 正式網址（APP_URL）；沒設或格式錯回 undefined，Next 會退回目前主機 */
export function siteMetadataBase(raw: string | undefined = process.env.APP_URL): URL | undefined {
  if (!raw?.trim()) return undefined;
  try {
    return new URL(raw.trim());
  } catch {
    console.error("[share] APP_URL 不是有效網址，og:image 會用目前主機");
    return undefined;
  }
}

export interface ShareMetadataInput {
  /** 搜尋用標題（articleSeoTitle）；省略就用「標題｜散場誌」 */
  seoTitle?: string;
  slug: string;
  title: string;
  description: string | null;
}

export function shareMetadata({ slug, title, description, seoTitle }: ShareMetadataInput): Metadata {
  const metadataBase = siteMetadataBase();
  const url = `/s/${slug}`;
  return {
    ...(metadataBase ? { metadataBase } : {}),
    // <title> 用 SEO 公式（帶作品名與「心得」），OG／Twitter 維持原標題
    title: seoTitle ?? `${title}｜散場誌`,
    description: description ?? undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: "zh_TW",
      title,
      description: description ?? undefined,
      url,
    },
    twitter: { card: "summary_large_image", title, description: description ?? undefined },
  };
}

/** 私人／收回／找不到：不帶任何文章內容，圖片是中性卡 */
export function withdrawnMetadata(): Metadata {
  const metadataBase = siteMetadataBase();
  return {
    ...(metadataBase ? { metadataBase } : {}),
    title: `${WITHDRAWN_TITLE}｜散場誌`,
    description: NEUTRAL_DESCRIPTION,
    robots: { index: false },
    openGraph: { siteName: SITE_NAME, locale: "zh_TW", title: WITHDRAWN_TITLE, description: NEUTRAL_DESCRIPTION },
    twitter: { card: "summary_large_image", title: WITHDRAWN_TITLE, description: NEUTRAL_DESCRIPTION },
  };
}
