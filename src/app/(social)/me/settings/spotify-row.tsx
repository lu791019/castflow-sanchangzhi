"use client";

import { useState } from "react";
import { CONNECT_MESSAGES, type ConnectResult } from "@/lib/spotify/connect-copy";

interface SpotifyRowProps {
  /** null＝讀不到狀態（DB 失敗），只顯示連結鈕 */
  initial: { connected: boolean; revoked: boolean } | null;
  /** callback 帶回來的結果（?spotify=…） */
  result: ConnectResult | null;
}

/**
 * 設定頁「連結 Spotify」（Q-64 C1）：聽完一張專輯，問要不要記一筆。測試階段只有允許名單內的人連得上。
 * 連結走整頁導向（/api/spotify/connect → Spotify → callback → 回這頁）；解除用 API 回傳直接換畫面，不靠 refresh。
 */
export function SpotifyRow({ initial, result }: SpotifyRowProps) {
  const [connected, setConnected] = useState(initial?.connected ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(result ? CONNECT_MESSAGES[result] : null);
  const revoked = !connected && initial?.revoked === true;

  const disconnect = async () => {
    setPending(true);
    setError(null);
    const response = await fetch("/api/spotify/connection", { method: "DELETE" }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError("解除連結失敗，再試一次。");
      return;
    }
    setConnected(false);
    setNotice({ tone: "ok", text: "已解除連結，Spotify 授權也已從散場誌刪除。" });
  };

  return (
    <div id="spotify" className="border-b border-ink-200 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-lede text-ink-950">Spotify 收聽紀錄</span>
          <span className="text-caption leading-[1.6] text-ink-600">
            {connected ? "已連結。聽完一張專輯，會問你要不要記一筆。" : "聽完一張專輯，問你要不要記一筆。目前是測試階段，名額有限。"}
          </span>
        </span>
        {connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="min-h-11 flex-none text-note font-bold text-ink-700 disabled:text-ink-400"
          >
            {pending ? "解除中…" : "解除連結"}
          </button>
        ) : (
          <a href="/api/spotify/connect" className="flex min-h-11 flex-none items-center text-note font-bold text-ember-dark no-underline">
            {revoked ? "重新連結" : "連結 Spotify"}
          </a>
        )}
      </div>
      {revoked ? <p className="mt-1.5 mb-0 text-caption text-ink-600">Spotify 那邊的授權被取消了，要繼續收到提醒請重新連結。</p> : null}
      {notice ? (
        <p role="status" className={`mt-1.5 mb-0 text-caption leading-[1.7] ${notice.tone === "ok" ? "text-ink-700" : "text-ember-deep"}`}>
          {notice.text}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 mb-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
