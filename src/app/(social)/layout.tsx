import { NavStatusProvider } from "@/components/app-shell/nav-status";
import { BottomNav, WideNav } from "@/components/app-shell/bottom-nav";
import { PageUnderSheet } from "@/components/app-shell/page-under-sheet";
import { LogSheetProvider } from "@/components/journal/log-sheet-provider";
import { OfflineBanner } from "@/components/app-shell/offline-banner";
import { communityEnabled } from "@/lib/features";
import { TourMount } from "@/components/tour/tour-mount";
import { requestUserId } from "@/lib/auth/request-user";
import "./social.css";

/**
 * 社交殼：手機單欄＋底部導航；平板左側直欄＋浮動圓鈕；桌機髮絲線刊頭（P4 斷點與排版規格）。
 * 頁面內容包在殼的 <main> 地標裡（各頁不再自帶 main，避免巢狀）；訪客不輪詢未讀數（UX-21）。
 */
export default async function SocialLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const signedIn = (await requestUserId()) !== null;
  return (
    <NavStatusProvider>
      <LogSheetProvider>
        <div className="min-h-dvh overflow-x-clip bg-paper font-sans-tc text-ink-900 md:pl-[72px] lg:pl-0">
          <WideNav community={communityEnabled()} signedIn={signedIn} />
          <PageUnderSheet>
            <OfflineBanner />
            <main>{children}</main>
          </PageUnderSheet>
          <BottomNav signedIn={signedIn} />
          <TourMount />
        </div>
      </LogSheetProvider>
    </NavStatusProvider>
  );
}
