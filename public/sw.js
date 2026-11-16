/* CastFlow service worker：接收 Web Push 提醒（「昨晚的《海街日記》」），點擊開啟 /say?journal=<id>。
   支援動作鈕的平台（Android／桌機）多兩顆：「說說看」＝點開；「只記不說」＝靜靜標記，不開 App。 */

const DEFAULT_URL = "/";
const ICON = "/icons/icon-192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** 只接受同源相對路徑，避免推播 payload 把人導去外站 */
function safeUrl(raw) {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_URL;
  }
  return raw;
}

function parsePayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

const JOURNAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /say?journal=<id> → id；不是日誌提醒回 null */
function journalIdOf(url) {
  const id = new URL(url, self.location.origin).searchParams.get("journal");
  return id && JOURNAL_ID.test(id) ? id : null;
}

/** 只記不說：同源帶 cookie 呼叫 API；失敗不打擾使用者（提醒仍在收件匣） */
function skipJournal(id) {
  return fetch(`/api/journal/${id}/skip`, { method: "POST", credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) console.warn("[sw] 只記不說失敗", response.status);
    })
    .catch((error) => console.warn("[sw] 只記不說失敗", error));
}

/** App 有畫面正開著（使用者看得到）：「我的」小點已經會亮，不再跳通知 */
function hasVisibleWindow() {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windows) => windows.some((client) => client.visibilityState === "visible"));
}

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);
  const title = typeof payload.title === "string" && payload.title ? payload.title : "散場誌";
  const quiet = payload.quietIfOpen === true ? hasVisibleWindow() : Promise.resolve(false);
  event.waitUntil(
    quiet.then((skip) => skip ? undefined : self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "",
      icon: ICON,
      badge: ICON,
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      data: { url: safeUrl(payload.url) },
      actions: journalIdOf(safeUrl(payload.url))
        ? [
            { action: "say", title: "說說看" },
            { action: "skip", title: "只記不說" },
          ]
        : [],
    })),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  if (event.action === "skip") {
    const id = journalIdOf(url);
    if (id) event.waitUntil(skipJournal(id));
    return;
  }
  const target = new URL(safeUrl(event.notification.data && event.notification.data.url), self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const sameOrigin = windows.find((client) => new URL(client.url).origin === target.origin);
      if (sameOrigin) {
        return sameOrigin.focus().then((client) => client.navigate(target.href));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
