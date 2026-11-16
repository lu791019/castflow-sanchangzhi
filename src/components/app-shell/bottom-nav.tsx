"use client";

import Link from "next/link";
import { formatClock } from "@/lib/say/stage";
import { usePathname, useRouter } from "next/navigation";
import { useLogSheet } from "@/components/journal/log-sheet-provider";
import { CenterPressButton } from "./center-press-button";
import { BeforeIcon, EqualizerIcon, HomeIcon, JournalIcon, MeIcon } from "./nav-icons";
import { useNavStatus, type ShellStatus } from "./nav-status";
import { ReadyTag, useReadyFlash } from "./ready-flash";
import { activeFromPathname, BEFORE_PATH, FEED_PATH, isNavHidden, wideActiveFromPathname, wideNavItems, type NavActiveItem } from "./nav-routes";
import { useUnreadCount } from "./use-unread-count";
import { DesktopMasthead, TabletRail } from "./wide-nav";

export type { NavActiveItem } from "./nav-routes";

function NavItem({
  href,
  label,
  icon,
  isActive,
  disabled,
  showDot,
  className,
  tour,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  disabled: boolean;
  showDot?: boolean;
  className?: string;
  /** 新手導覽 data-tour */
  tour?: string;
}) {
  const tone = disabled
    ? "pointer-events-none text-ink-300"
    : isActive
      ? "text-ink-950"
      : "text-ink-600";
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled || undefined}
      data-tour={tour}
      className={`relative flex min-h-11 flex-col items-center gap-1 no-underline ${tone} ${className ?? ""}`}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute -top-[11px] block h-0.5 w-5 bg-ember"
        />
      ) : null}
      {showDot ? (
        <span className="relative block size-[22px]">
          {icon}
          <span className="absolute -top-0.5 -right-1 block size-[7px]">
            <span aria-hidden="true" className="p4-dot-ring absolute inset-0 block rounded-full border-[1.5px] border-ember" />
            <span className="p4-dot block size-full rounded-full bg-ember shadow-[0_0_0_2px_var(--color-paper)]" />
          </span>
        </span>
      ) : (
        icon
      )}
      <span className={`text-eyebrow ${isActive ? "font-bold" : ""}`}>
        {label}
      </span>
    </Link>
  );
}

/** 中央鈕：idle＝點一下記一筆／按住說一段（center-press-button）、recording（C）、processing（D） */
function CenterButton({
  status,
  recordSeconds,
  demoPressed,
  readyFlash = false,
  onTap,
  onHold,
}: {
  status: ShellStatus;
  recordSeconds: number;
  demoPressed?: boolean;
  readyFlash?: boolean;
  onTap: () => void;
  onHold: () => void;
}) {
  if (status === "recording") {
    return (
      <div className="-mt-8 flex flex-col items-center gap-[5px] justify-self-center">
        <span className="relative block size-16">
          <span className="shell-ring absolute inset-0 block rounded-full border-[1.5px] border-ember" />
          <span className="shell-ring-delay absolute inset-0 block rounded-full border-[1.5px] border-ember" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ember shadow-[0_0_0_5px_var(--color-paper)]">
            <span className="block size-[18px] rounded-[3px] bg-paper" />
          </span>
        </span>
        <span className="text-eyebrow font-bold tracking-[0.08em] text-ember-dark tabular-nums">
          錄音中 {formatClock(recordSeconds)}
        </span>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <Link
        href="/say"
        aria-label="整理中，點擊查看"
        className="-mt-8 flex flex-col items-center gap-[5px] justify-self-center no-underline"
      >
        <span className="relative block size-16">
          <svg
            width="74"
            height="74"
            viewBox="0 0 74 74"
            fill="none"
            className="shell-spin absolute -top-[5px] -left-[5px]"
            aria-hidden="true"
          >
            <circle cx="37" cy="37" r="35" stroke="var(--color-ink-200)" strokeWidth="1.5" />
            <path
              d="M37 2a35 35 0 0 1 35 35"
              stroke="var(--color-ember)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-950">
            <EqualizerIcon />
          </span>
        </span>
        <span className="text-eyebrow font-bold tracking-[0.08em] text-ember-dark">
          整理中…
        </span>
      </Link>
    );
  }

  return (
    <div data-tour="center-button" className="relative justify-self-center">
      {readyFlash ? <ReadyTag /> : null}
      <CenterPressButton onTap={onTap} onHold={onHold} demoPressed={demoPressed} />
    </div>
  );
}

export interface BottomNavBarProps {
  active: NavActiveItem;
  status: ShellStatus;
  recordSeconds?: number;
  showReadyDot?: boolean;
  /** 狀態 B 展示用：強制按下樣式 */
  demoPressed?: boolean;
  /** 整理剛完成：圓鈕上方探出「校樣」標籤 */
  readyFlash?: boolean;
  /** 中央圓鈕點一下（記一筆）；展示頁不傳 */
  onTapCenter?: () => void;
  /** 中央圓鈕按住放開（說一段）；展示頁不傳 */
  onHoldCenter?: () => void;
}

const noop = () => {};

/** 純展示列：高 84、1fr 1fr 96px 1fr 1fr（散場之前／目錄／圓鈕／日誌／我的），供實際導航與狀態展示頁共用 */
export function BottomNavBar({
  active,
  status,
  recordSeconds = 0,
  showReadyDot = false,
  demoPressed = false,
  readyFlash = false,
  onTapCenter = noop,
  onHoldCenter = noop,
}: BottomNavBarProps) {
  const disabled = status === "recording";
  return (
    <div className="box-border grid h-[84px] grid-cols-[1fr_1fr_96px_1fr_1fr] items-start border-t border-ink-200 bg-paper pt-2.5">
      <NavItem
        href={BEFORE_PATH}
        label="散場之前"
        icon={<BeforeIcon />}
        isActive={active === "before"}
        disabled={disabled}
      />
      <NavItem
        href={FEED_PATH}
        label="目錄"
        icon={<HomeIcon />}
        isActive={active === "home"}
        disabled={disabled}
      />
      <CenterButton
        status={status}
        recordSeconds={recordSeconds}
        demoPressed={demoPressed}
        readyFlash={readyFlash}
        onTap={onTapCenter}
        onHold={onHoldCenter}
      />
      <NavItem
        href="/journal"
        label="日誌"
        icon={<JournalIcon />}
        isActive={active === "journal"}
        disabled={disabled}
        tour="nav-journal"
      />
      <NavItem
        href="/me"
        label="我的"
        icon={<MeIcon />}
        isActive={active === "me"}
        disabled={disabled}
        showDot={showReadyDot}
      />
    </div>
  );
}

/** 導航共用狀態：目前分頁、紅點、錄音中停用 */
function useShellNav(signedIn: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = useNavStatus();
  const { openLogSheet } = useLogSheet();
  const unreadCount = useUnreadCount(pathname, signedIn);
  const readyFlash = useReadyFlash(nav.readyEpisodeId);
  return {
    hidden: isNavHidden(pathname),
    active: activeFromPathname(pathname),
    wideActive: wideActiveFromPathname(pathname),
    status: nav.status,
    recordSeconds: nav.recordSeconds,
    showDot: nav.readyEpisodeId !== null || unreadCount > 0,
    readyFlash,
    openLogSheet: () => openLogSheet(),
    goSay: () => router.push("/say"),
  };
}

/**
 * 底部：手機＝底部導航 84；平板（768–1023）＝內容區底部中央浮動圓鈕（距底 28）；桌機不出現。
 * 說一段全螢幕頁等不顯示。「我的」紅點＝整理好的文章或收件匣未讀
 */
export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const nav = useShellNav(signedIn);
  if (nav.hidden) return null;

  return (
    <>
      <nav aria-label="主要導覽" className="fixed inset-x-0 bottom-0 z-40 bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto w-full max-w-[480px]">
          <BottomNavBar
            active={nav.active}
            status={nav.status}
            recordSeconds={nav.recordSeconds}
            showReadyDot={nav.showDot}
            readyFlash={nav.readyFlash}
            onTapCenter={nav.openLogSheet}
            onHoldCenter={nav.goSay}
          />
        </div>
      </nav>
      <div className="fixed bottom-7 left-[calc(72px+(100vw-72px)/2)] z-40 hidden -translate-x-1/2 pt-8 md:block lg:hidden">
        <CenterButton
          status={nav.status}
          recordSeconds={nav.recordSeconds}
          readyFlash={nav.readyFlash}
          onTap={nav.openLogSheet}
          onHold={nav.goSay}
        />
      </div>
    </>
  );
}

/** 頂部：平板左側直欄＋桌機髮絲線刊頭 */
/** community：社群開關（server 端 layout 傳入；關閉時「索引」連回作品列表）；signedIn：訪客不查未讀 */
export function WideNav({ community, signedIn }: { community: boolean; signedIn: boolean }) {
  const nav = useShellNav(signedIn);
  if (nav.hidden) return null;
  const disabled = nav.status === "recording";
  const items = wideNavItems(community);
  return (
    <>
      <TabletRail items={items} active={nav.wideActive} showDot={nav.showDot} disabled={disabled} />
      <DesktopMasthead items={items} active={nav.wideActive} showDot={nav.showDot} disabled={disabled} onLog={nav.openLogSheet} />
    </>
  );
}
