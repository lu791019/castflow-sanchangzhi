/**
 * 瀏覽器端 Web Push 訂閱流程（之後 UI 接線用，本身不渲染任何東西）：
 * 註冊 /sw.js → 要通知權限 → pushManager.subscribe → POST /api/push/subscriptions。
 * iPhone 只有「加入主畫面」後的 standalone 模式才有 PushManager。
 */

export type PushSupport = "supported" | "unsupported" | "needs-home-screen";

export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (hasApis) return "supported";
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return isIos ? "needs-home-screen" : "unsupported";
}

/** VAPID 公鑰（base64url）→ applicationServerKey */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "needs-home-screen" | "denied" | "not-configured" | "failed"; message?: string };

export async function subscribeToPush(): Promise<SubscribeResult> {
  const support = detectPushSupport();
  if (support !== "supported") return { ok: false, reason: support };

  const keyResponse = await fetch("/api/push/public-key");
  if (!keyResponse.ok) return { ok: false, reason: "not-configured" };
  const { publicKey } = (await keyResponse.json()) as { publicKey: string };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const response = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) return { ok: false, reason: "failed", message: `HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}
