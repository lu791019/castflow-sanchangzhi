"use client";

import { useEffect, useState } from "react";

/** 同一次換頁，底部導航、平板直欄、桌機刊頭會同時要未讀數：共用同一個請求 */
const SHARE_WINDOW_MS = 1000;
let shared: { pathname: string; at: number; request: Promise<number> } | null = null;

function fetchUnread(pathname: string): Promise<number> {
  const now = Date.now();
  if (shared && shared.pathname === pathname && now - shared.at < SHARE_WINDOW_MS) return shared.request;
  const request = fetch("/api/notifications/unread").then(async (response) => {
    if (!response.ok) return 0;
    const body = (await response.json()) as { unreadCount?: number };
    return body.unreadCount ?? 0;
  });
  shared = { pathname, at: now, request };
  return request;
}

/**
 * 收件匣未讀數（導航紅點用）：換頁時重抓一次（看完收件匣回來就會消失）。
 * 訪客（signedIn=false）不發請求（UX-21）；session 過期回 401 → 視為 0；讀取失敗也不打擾畫面，只記 log。
 */
export function useUnreadCount(pathname: string, signedIn: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetchUnread(pathname)
      .then((value) => {
        if (active) setCount(value);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("[nav] 讀取未讀數失敗", error instanceof Error ? error.message : error);
      });
    return () => {
      active = false;
    };
  }, [pathname, signedIn]);
  return signedIn ? count : 0;
}
