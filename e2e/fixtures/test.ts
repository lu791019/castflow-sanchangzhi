/**
 * 共用 test：每個測試自己建帳號、自己清。
 * - accounts.newEmail(tag)：產生唯一測試 email 並登記，測試結束後刪該使用者全部資料、auth user 與 Mailpit 信件
 * - accounts.trackWork(id)：測試期間新建的作品，結束後若沒被引用就刪（測試開始前就有的作品一律不刪）；
 *   測試帳號集數／日誌用到的作品、測試中 POST /api/works 拿到的作品也自動列入
 */

import { test as base, type BrowserContext, type Page, type Response } from "@playwright/test";
import { deleteTestUser, deleteWorkIfUnused, findUserIdByEmail, workIdsUsedBy } from "./admin";
import { deleteMailsTo, uniqueTestEmail } from "./auth";

export interface Accounts {
  newEmail: (tag: string) => string;
  userIdOf: (email: string) => Promise<string>;
  trackWork: (workId: string) => void;
}

/** 選作品會 POST /api/works（建立或取回）：回傳的作品一律登記，清理時只刪測試中才建、沒人引用的 */
function isWorkCreate(response: Response): boolean {
  return response.request().method() === "POST" && new URL(response.url()).pathname === "/api/works";
}

export const test = base.extend<{ accounts: Accounts; trackPickedWorks: void }>({
  // Playwright 以解構參數判斷相依 fixture；這裡沒有相依
  accounts: async ({}, provide) => {
    const emails: string[] = [];
    const works: string[] = [];
    // DB 與本機時鐘可能差幾秒：往前留 1 分鐘仍遠晚於任何既有作品
    const startedAt = new Date(Date.now() - 60_000);
    const accounts: Accounts = {
      newEmail: (tag) => {
        const email = uniqueTestEmail(tag);
        emails.push(email);
        return email;
      },
      userIdOf: async (email) => {
        const id = await findUserIdByEmail(email);
        if (!id) throw new Error(`[e2e] 找不到測試帳號 ${email}`);
        return id;
      },
      trackWork: (workId) => {
        works.push(workId);
      },
    };

    await provide(accounts);

    const failures: string[] = [];
    for (const email of emails) {
      try {
        const id = await findUserIdByEmail(email);
        if (id) {
          // 介面上建的作品（記一筆場外、挑作品）沒登記也一起收：先記下這位用過的作品，刪完帳號再刪沒人引用、且測試中才建的
          works.push(...(await workIdsUsedBy(id)));
          await deleteTestUser({ id, email });
        }
        await deleteMailsTo(email);
      } catch (error) {
        failures.push(`${email}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    for (const workId of new Set(works)) {
      try {
        await deleteWorkIfUnused(workId, startedAt);
      } catch (error) {
        failures.push(`work ${workId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures.length > 0) throw new Error(`[e2e] 測試資料清理失敗：\n${failures.join("\n")}`);
  },
  // 測試中途失敗時 spec 自己的 trackWork 跑不到（例：tour 選了作品、還沒記下就逾時）：從回應直接收
  trackPickedWorks: [
    async ({ context, accounts }, provide) => {
      const pending: Promise<void>[] = [];
      const onResponse = (response: Response) => {
        if (!isWorkCreate(response)) return;
        pending.push(
          response
            .json()
            .then((body: { data?: { work?: { id?: unknown } } }) => {
              const id = body.data?.work?.id;
              if (typeof id === "string") accounts.trackWork(id);
            })
            .catch(() => undefined),
        );
      };
      context.on("response", onResponse);
      await provide();
      context.off("response", onResponse);
      await Promise.all(pending);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

/**
 * 無頭 Chrome 在 macOS 取麥克風會卡住：把 getUserMedia 換成 Web Audio 振盪器的串流，
 * 之後的 MediaRecorder 走真程式碼。
 */
export async function useFakeMicrophone(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const fake = async (): Promise<MediaStream> => {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      oscillator.frequency.value = 440;
      const destination = audio.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      return destination.stream;
    };
    MediaDevices.prototype.getUserMedia = fake;
  });
}

/** 讀說一段的 IndexedDB 草稿（castflow-say / drafts / current）；沒有回 null */
export async function readSayDraft(page: Page): Promise<{ kind: string; text?: string; seconds?: number } | null> {
  return page.evaluate(
    () =>
      new Promise<{ kind: string; text?: string; seconds?: number } | null>((resolve, reject) => {
        const open = indexedDB.open("castflow-say", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("drafts");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction("drafts", "readonly").objectStore("drafts").get("current");
          request.onsuccess = () => {
            const value = request.result as { kind: string; text?: string; seconds?: number } | undefined;
            db.close();
            resolve(value ? { kind: value.kind, text: value.text, seconds: value.seconds } : null);
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

/** 按住錄音鈕 holdMs 毫秒後放開（pointer 事件由 mouse 觸發） */
export async function holdToRecord(page: Page, holdMs: number): Promise<void> {
  const button = page.getByRole("button", { name: "按住說話" });
  const box = await button.boundingBox();
  if (!box) throw new Error("[e2e] 找不到錄音按鈕位置");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.getByText("正在聽……").waitFor();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}
