"use client";

/**
 * 依瀏覽器狀態切換：要權限（sheet）／iPhone 先加入主畫面／已開啟／已封鎖／不支援。
 * 「好，提醒我」→ lib/push/client 的 subscribeToPush（註冊 sw.js、要權限、存訂閱）。
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { markPushPrompted } from "@/components/journal/push-permission";
import { detectPushSupport, subscribeToPush } from "@/lib/push/client";
import { HomeScreenGuide } from "./home-screen-guide";
import { PermissionSheet, StatusPanel } from "./permission-views";

export interface FirstEntryCard {
  title: string;
  place: string;
  posterUrl: string | null;
}

export type EnableState =
  | "checking"
  | "ask"
  | "ios-home"
  | "granted"
  | "denied"
  | "unsupported"
  | "failed";

interface EnableNotificationsProps {
  card: FirstEntryCard | null;
  preview: { title: string; body: string };
  backHref: string;
}

function initialState(): EnableState {
  const support = detectPushSupport();
  if (support === "needs-home-screen") return "ios-home";
  if (support === "unsupported") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "ask";
}

export function EnableNotifications({ card, preview, backHref }: EnableNotificationsProps) {
  const router = useRouter();
  const [state, setState] = useState<EnableState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    markPushPrompted();
    const timer = setTimeout(() => setState(initialState()), 0);
    return () => clearTimeout(timer);
  }, []);

  const leave = () => router.replace(backHref);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    const result = await subscribeToPush();
    setBusy(false);
    if (result.ok) return setState("granted");
    if (result.reason === "denied") return setState("denied");
    if (result.reason === "needs-home-screen") return setState("ios-home");
    if (result.reason === "unsupported") return setState("unsupported");
    console.error("[push] 訂閱失敗", result.reason, result.message);
    setMessage(result.reason === "not-configured" ? "提醒服務還沒設定好，晚點再試。" : "沒開成功，再按一次試試。");
    setState("failed");
  };

  if (state === "checking") return <div className="min-h-dvh" aria-busy="true" />;
  if (state === "ios-home") return <HomeScreenGuide onDone={leave} onLater={leave} />;
  if (state === "ask" || state === "failed") {
    return (
      <PermissionSheet card={card} preview={preview} busy={busy} error={message} onEnable={enable} onSkip={leave} />
    );
  }
  return <StatusPanel state={state} onBack={leave} />;
}
