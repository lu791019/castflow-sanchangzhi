/**
 * 說一段草稿的瀏覽器端儲存（IndexedDB：錄音是 Blob，localStorage 放不下）。
 * 只存一份（key 固定）；讀不到、瀏覽器不支援或私密模式時一律當作沒有草稿，並在 console 留紀錄。
 */

import type { SayDraft } from "./draft";

const DB_NAME = "castflow-say";
const STORE = "drafts";
const KEY = "current";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("此瀏覽器不支援 IndexedDB"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("開啟草稿儲存失敗"));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("草稿儲存操作失敗"));
    });
  } finally {
    db.close();
  }
}

/** 存草稿；失敗要讓呼叫端知道（否則使用者登入回來會以為內容不見了） */
export function saveSayDraft(draft: SayDraft): Promise<IDBValidKey> {
  return run("readwrite", (store) => store.put(draft, KEY));
}

export async function loadSayDraft(): Promise<SayDraft | null> {
  try {
    return ((await run("readonly", (store) => store.get(KEY))) as SayDraft | undefined) ?? null;
  } catch (error) {
    console.error("[say] 讀取草稿失敗", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function clearSayDraft(): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(KEY));
  } catch (error) {
    console.error("[say] 清除草稿失敗", error instanceof Error ? error.message : error);
  }
}
