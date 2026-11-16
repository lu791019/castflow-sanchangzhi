/** 社交殼導航共用：哪些頁不出現導航、目前在哪一個分頁 */

export type NavActiveItem = "before" | "home" | "index" | "journal" | "me" | null;

/** 目錄（刊物首頁）的連結：帶 tab 參數，登入者打開裸 `/` 會轉到散場之前，帶參數才是要看目錄 */
export const FEED_PATH = "/?tab=all";

/** 說一段全螢幕、收件匣與通知引導（設計稿皆無底部導航）不顯示 */
export const NAV_HIDDEN_PREFIXES = ["/say", "/dev/nav", "/notifications"];

export function isNavHidden(pathname: string): boolean {
  return NAV_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** 登入者首屏（散場之前）與落地頁 */
export const BEFORE_PATH = "/before";

/** 索引、作者專欄、作品頁屬於目錄（作品格拿掉後，索引從目錄刊頭切換進入，Dex 10/13） */
const CATALOG_PREFIXES = ["/catalog", "/authors", "/works"];

function isCatalogPath(pathname: string): boolean {
  return CATALOG_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function activeFromPathname(pathname: string): NavActiveItem {
  if (pathname === BEFORE_PATH || pathname.startsWith(`${BEFORE_PATH}/`)) return "before";
  if (pathname === "/" || isCatalogPath(pathname)) return "home";
  if (pathname.startsWith("/journal")) return "journal";
  if (pathname.startsWith("/me")) return "me";
  return null;
}

/** 平板直欄與桌機刊頭：索引是獨立分頁（寬螢幕沒有目錄刊頭的切換），索引、作者專欄、作品頁選中「索引」 */
export function wideActiveFromPathname(pathname: string): NavActiveItem {
  return isCatalogPath(pathname) ? "index" : activeFromPathname(pathname);
}

export interface WideNavItem {
  key: Exclude<NavActiveItem, null>;
  label: string;
  href: string;
}

/** 導覽四格（散場之前／目錄／●／日誌／我的，10/13 grill Q-34）：手機底部導覽 */
export const NAV_ITEMS: readonly WideNavItem[] = [
  { key: "before", label: "散場之前", href: BEFORE_PATH },
  { key: "home", label: "目錄", href: FEED_PATH },
  { key: "journal", label: "日誌", href: "/journal" },
  { key: "me", label: "我的", href: "/me" },
];

/** 平板直欄與桌機刊頭：四格中間多一個「索引」（手機從目錄刊頭切換）；社群關閉時「索引」回到作品列表 */
export function wideNavItems(community: boolean): readonly WideNavItem[] {
  return [
    NAV_ITEMS[0],
    NAV_ITEMS[1],
    { key: "index", label: "索引", href: community ? "/catalog" : "/works" },
    NAV_ITEMS[2],
    NAV_ITEMS[3],
  ];
}
