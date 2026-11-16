/**
 * 單值快取：TTL 內直接回；過期就重抓，重抓失敗時回上一次的值並通知（降級不可靜默）。
 * 同時只會有一個上游請求（並發共用同一個 promise）。
 */

export interface StaleCacheOptions<T> {
  ttlMs: number;
  load: () => Promise<T>;
  /** 重抓失敗但還有舊值：交給呼叫端推警報 */
  onStale: (error: unknown, ageMs: number) => void;
  now?: () => number;
}

export interface StaleCache<T> {
  get: () => Promise<T>;
}

export function createStaleCache<T>({ ttlMs, load, onStale, now = Date.now }: StaleCacheOptions<T>): StaleCache<T> {
  let entry: { value: T; loadedAt: number } | null = null;
  let inflight: Promise<T> | null = null;

  async function refresh(): Promise<T> {
    try {
      const value = await load();
      entry = { value, loadedAt: now() };
      return value;
    } catch (error) {
      if (!entry) throw error;
      onStale(error, now() - entry.loadedAt);
      return entry.value;
    }
  }

  return {
    get: () => {
      if (entry && now() - entry.loadedAt < ttlMs) return Promise.resolve(entry.value);
      if (!inflight) {
        inflight = refresh().finally(() => {
          inflight = null;
        });
      }
      return inflight;
    },
  };
}
