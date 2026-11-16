/** 站台公開網址（APP_URL）；沒設時退回正式站，避免 sitemap 與 canonical 指到 localhost */

import { siteMetadataBase } from "@/lib/share/share-metadata";

export const SITE_FALLBACK_ORIGIN = "https://castflow.daydreamdex.com";
export const SITE_TITLE = "散場誌";
export const SITE_DESCRIPTION = "看完、聽完、逛完，說一段，變成一篇你的文章。電影、影集、Podcast、演出與展覽的視聽日誌，附在哪看、去哪買票。";

export function siteOriginString(): string {
  return (siteMetadataBase()?.origin ?? SITE_FALLBACK_ORIGIN).replace(/\/$/, "");
}
