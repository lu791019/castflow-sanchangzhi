"use client";

/**
 * 等待 4・離線橫幅（banner.offline：ember-50 底、ink 字、高 36、全寬、圖示 15）。
 * offline.queue：斷線 3 秒後才出現（避免閃一下）；連上立刻收起。不擋畫面，放在頁面最上方。
 */

import { useEffect, useState } from "react";

const OFFLINE_DELAY_MS = 3000;

function useOfflineAfterDelay(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const goOffline = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setOffline(true), OFFLINE_DELAY_MS);
    };
    const goOnline = () => {
      window.clearTimeout(timer);
      setOffline(false);
    };
    if (!navigator.onLine) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);
  return offline;
}

export function OfflineBanner() {
  const offline = useOfflineAfterDelay();
  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-30 flex h-9 items-center gap-2 bg-ember-tint px-4">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-900)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 8.5a15 15 0 0 1 6-3.3M22 8.5a15 15 0 0 0-9.5-3.9M5.5 12.5a10 10 0 0 1 3.4-2.2M18.5 12.5a10 10 0 0 0-2.3-1.7M9 16a5 5 0 0 1 6 0M12 20h.01M3 3l18 18" />
      </svg>
      <span className="flex-1 text-caption text-ink-900">目前離線，記一筆會先存在手機裡</span>
    </div>
  );
}
